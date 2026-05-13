import { useCallback, useEffect, useState } from 'react';
import { resolveApiBaseURL, useApi } from '~/shared/api';
import { useAuth } from '~/shared/hooks/use-auth';
import type { ChildProfile, CreateChildInput, UpdateChildInput } from './types';

export interface UploadChildImageInput {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface UseChildrenResult {
  children: ChildProfile[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: CreateChildInput) => Promise<ChildProfile>;
  update: (id: string, input: UpdateChildInput) => Promise<ChildProfile>;
  remove: (id: string) => Promise<void>;
  uploadImage: (
    id: string,
    asset: UploadChildImageInput,
  ) => Promise<ChildProfile>;
}

export function useChildren(): UseChildrenResult {
  const api = useApi();
  const { user, bearerToken } = useAuth();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setChildren([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.get<ChildProfile[]>('/children');
      setChildren(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load children'));
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateChildInput) => {
      const created = await api.post<ChildProfile>('/children', input);
      setChildren((prev) => [...prev, created]);
      return created;
    },
    [api],
  );

  const update = useCallback(
    async (id: string, input: UpdateChildInput) => {
      const updated = await api.patch<ChildProfile>(`/children/${id}`, input);
      setChildren((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [api],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete<void>(`/children/${id}`);
      setChildren((prev) => prev.filter((c) => c.id !== id));
    },
    [api],
  );

  /**
   * Upload a profile picture for an existing child. Uses raw fetch (not the
   * shared apiFetch) because we need multipart/form-data and must let the
   * runtime set the boundary header itself.
   */
  const uploadImage = useCallback(
    async (id: string, asset: UploadChildImageInput) => {
      if (!bearerToken) {
        throw new Error('Not signed in');
      }
      const baseURL = resolveApiBaseURL();
      const ext = guessExtension(asset);
      const mime = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const form = new FormData();
      // React Native's FormData accepts this RN-specific blob shape directly.
      form.append('file', {
        uri: asset.uri,
        type: mime,
        name: asset.fileName ?? `avatar.${ext}`,
      } as unknown as Blob);

      const response = await fetch(`${baseURL}/children/${id}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearerToken}` },
        body: form,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Image upload failed (${response.status}): ${text || response.statusText}`,
        );
      }
      const updated = (await response.json()) as ChildProfile;
      setChildren((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [bearerToken],
  );

  return {
    children,
    isLoading,
    error,
    refresh,
    create,
    update,
    remove,
    uploadImage,
  };
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
