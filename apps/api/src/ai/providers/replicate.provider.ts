import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import type { AppConfigurationType } from '../../config/configuration';
import type {
  AiCapability,
  ImageGenerationOptions,
  ImageGenerationResult,
  Language,
  SpeechGenerationOptions,
  SpeechGenerationResult,
} from '../types';
import type { AiProvider } from './provider.interface';

/**
 * Language boost codes Replicate's TTS models accept. Mirrors the catalog
 * we curate in the web project.
 */
const LANGUAGE_BOOST: Record<Language, string> = {
  en: 'English',
  fr: 'French',
  pt: 'Portuguese',
  it: 'Italian',
};

@Injectable()
export class ReplicateProvider implements AiProvider {
  readonly id = 'replicate' as const;
  readonly capabilities: ReadonlyArray<AiCapability> = ['image', 'speech'];

  private client: Replicate | null = null;

  constructor(
    private readonly config: ConfigService<AppConfigurationType, true>,
  ) {}

  async generateImage(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const ai = this.config.getOrThrow('ai', { infer: true });
    const model = (options.model ?? ai.models.image) as `${string}/${string}`;

    const output = await this.getClient().run(model, {
      input: {
        prompt: options.prompt,
        output_format: 'jpg',
        disable_safety_checker: true,
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      },
    });

    return { images: [{ url: extractFileUrl(output) }] };
  }

  async generateSpeech(
    options: SpeechGenerationOptions,
  ): Promise<SpeechGenerationResult> {
    const ai = this.config.getOrThrow('ai', { infer: true });
    const model = (options.model ?? ai.models.speech) as `${string}/${string}`;

    const output = await this.getClient().run(model, {
      input: {
        text: options.text,
        emotion: 'happy',
        language_boost:
          LANGUAGE_BOOST[options.language ?? 'pt'] ?? LANGUAGE_BOOST.pt,
        ...(options.voice ? { voice_id: options.voice } : {}),
      },
    });

    const audioUrl = extractFileUrl(output);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio from Replicate: ${response.status}`,
      );
    }

    return {
      audio: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
    };
  }

  private getClient(): Replicate {
    if (!this.client) {
      const auth = this.config.getOrThrow('ai', { infer: true }).replicate
        .apiToken;
      if (!auth) {
        throw new Error('REPLICATE_API_TOKEN is not configured');
      }
      this.client = new Replicate({ auth });
    }
    return this.client;
  }
}

/** Extract a URL from Replicate's polymorphic output (FileOutput|string|array). */
function extractFileUrl(output: unknown): string {
  if (output && typeof output === 'object' && 'url' in output) {
    const url = (output as { url: (() => string | { href: string }) | string })
      .url;
    if (typeof url === 'function') return String(url());
    return String(url);
  }
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) {
    return extractFileUrl(output[0]);
  }
  return String(output);
}
