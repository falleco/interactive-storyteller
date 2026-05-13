import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigurationType } from '../config/configuration';

export interface UploadInput {
  /** Object key (relative path under the bucket). */
  key: string;
  /** File bytes. */
  body: Buffer | Uint8Array;
  /** MIME type. */
  contentType: string;
  /** Optional cache-control header (e.g. `public, max-age=31536000, immutable`). */
  cacheControl?: string;
}

export interface UploadResult {
  /** Object key (relative path under the bucket). */
  key: string;
  /** Publicly-accessible URL. */
  url: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  constructor(
    private readonly config: ConfigService<AppConfigurationType, true>,
  ) {}

  /** Upload bytes to the bucket and return the public URL. */
  async upload(input: UploadInput): Promise<UploadResult> {
    const s3 = this.config.getOrThrow('s3', { infer: true });
    const client = this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl,
      }),
    );

    return {
      key: input.key,
      url: this.getPublicUrl(input.key),
    };
  }

  /** Download a remote file and upload it to the bucket. */
  async uploadRemoteFile(input: {
    url: string;
    key: string;
    contentType?: string;
    cacheControl?: string;
  }): Promise<UploadResult> {
    const response = await fetch(input.url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${input.url} (status ${response.status})`,
      );
    }

    const contentType =
      input.contentType ??
      response.headers.get('content-type') ??
      'application/octet-stream';
    const body = Buffer.from(await response.arrayBuffer());

    return this.upload({
      key: input.key,
      body,
      contentType,
      cacheControl: input.cacheControl,
    });
  }

  /**
   * Delete a batch of object keys from the bucket. Succeeds when the bucket
   * call returns; per-object failures are logged. S3 `DeleteObjects` accepts
   * up to 1000 keys per request, so we chunk when given more.
   */
  async deleteMany(keys: string[]): Promise<void> {
    const unique = Array.from(new Set(keys.filter(Boolean)));
    if (unique.length === 0) return;

    const s3 = this.config.getOrThrow('s3', { infer: true });
    const client = this.getClient();
    const CHUNK = 1000;

    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const response = await client.send(
        new DeleteObjectsCommand({
          Bucket: s3.bucket,
          Delete: {
            Objects: slice.map((Key) => ({ Key })),
            Quiet: false,
          },
        }),
      );
      for (const err of response.Errors ?? []) {
        this.logger.warn(
          `S3 delete failed for ${err.Key}: ${err.Code} ${err.Message}`,
        );
      }
    }
  }

  /** Produce a presigned PUT URL clients can use to upload directly. */
  async getSignedUploadUrl(input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; key: string }> {
    const s3 = this.config.getOrThrow('s3', { infer: true });
    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: input.expiresInSeconds ?? 60 * 5,
    });
    return { url, key: input.key };
  }

  /** Build a canonical public URL for a key. Honors S3_PUBLIC_BASE_URL if set. */
  getPublicUrl(key: string): string {
    const s3 = this.config.getOrThrow('s3', { infer: true });
    if (s3.publicBaseUrl) {
      return `${trimTrailingSlash(s3.publicBaseUrl)}/${stripLeadingSlash(key)}`;
    }
    if (s3.endpoint) {
      const normalized = normalizeS3Endpoint(s3.endpoint, s3.bucket);
      if (normalized) {
        // R2-style: bucket goes in path
        return `${normalized}/${s3.bucket}/${stripLeadingSlash(key)}`;
      }
    }
    // Fallback to virtual-hosted-style S3 URL
    return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${stripLeadingSlash(
      key,
    )}`;
  }

  /** Join key segments with `/`, sanitizing each segment. */
  buildObjectKey(...segments: string[]): string {
    return segments
      .map((s) => s.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const s3 = this.config.getOrThrow('s3', { infer: true });

    if (!s3.bucket || !s3.region || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error(
        'S3 credentials are not configured. Set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.',
      );
    }

    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint
        ? (normalizeS3Endpoint(s3.endpoint, s3.bucket) ?? s3.endpoint)
        : undefined,
      forcePathStyle: isCloudflareR2Endpoint(s3.endpoint),
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
    });

    this.logger.log(
      `S3 client initialized for bucket "${s3.bucket}" in region "${s3.region}"`,
    );
    return this.client;
  }
}

function isCloudflareR2Endpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return false;
  try {
    return new URL(endpoint).hostname.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

/**
 * Normalize an S3-compatible endpoint, removing trailing-bucket paths that
 * Cloudflare and friends sometimes ship with. Returns undefined if the
 * endpoint is missing.
 */
function normalizeS3Endpoint(
  endpoint: string | undefined,
  bucket: string,
): string | undefined {
  if (!endpoint) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return endpoint;
  }
  const bucketPath = `/${bucket}`;
  if (
    isCloudflareR2Endpoint(endpoint) ||
    parsed.pathname === bucketPath ||
    parsed.pathname === `${bucketPath}/`
  ) {
    parsed.pathname = '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }
  return endpoint;
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
