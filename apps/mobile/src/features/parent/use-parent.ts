import { useCallback, useEffect, useState } from 'react';
import type { UploadChildImageInput } from '~/features/children';
import { resolveApiBaseURL, useApi } from '~/shared/api';
import { useAuth } from '~/shared/hooks/use-auth';
import type { ParentProfile, UpdateParentInput } from './types';

export interface UseParentResult {
  parent: ParentProfile | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  update: (input: UpdateParentInput) => Promise<ParentProfile>;
  uploadImage: (asset: UploadChildImageInput) => Promise<ParentProfile>;
}

export function useParent(): UseParentResult {
  const api = useApi();
  const { user, bearerToken } = useAuth();
  const [parent, setParent] = useState<ParentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setParent(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await api.get<ParentProfile>('/me');
      setParent(detail);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (input: UpdateParentInput) => {
      const updated = await api.patch<ParentProfile>('/me', input);
      setParent(updated);
      return updated;
    },
    [api],
  );

  /**
   * Multipart upload of the parent's avatar — uses raw fetch (not apiFetch)
   * because we need the runtime to set the multipart boundary itself.
   */
  const uploadImage = useCallback(
    async (asset: UploadChildImageInput) => {
      if (!bearerToken) throw new Error('Not signed in');
      const baseURL = resolveApiBaseURL();
      const ext = guessExtension(asset);
      const mime = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        type: mime,
        name: asset.fileName ?? `avatar.${ext}`,
      } as unknown as Blob);

      const response = await fetch(`${baseURL}/me/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearerToken}` },
        body: form,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Profile picture upload failed (${response.status}): ${text || response.statusText}`,
        );
      }
      const updated = (await response.json()) as ParentProfile;
      setParent(updated);
      return updated;
    },
    [bearerToken],
  );

  return { parent, isLoading, error, refresh, update, uploadImage };
}

function guessExtension(asset: UploadChildImageInput): string {
  const fromName = asset.fileName?.split('.').pop()?.toLowerCase();
  if (fromName && /^(jpg|jpeg|png|webp)$/.test(fromName)) return fromName;
  const fromUri = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (fromUri && /^(jpg|jpeg|png|webp)$/.test(fromUri)) return fromUri;
  if (asset.mimeType?.includes('png')) return 'png';
  if (asset.mimeType?.includes('webp')) return 'webp';
  return 'jpg';
}
