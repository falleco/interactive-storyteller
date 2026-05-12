import { useCallback, useMemo } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { type ApiFetchOptions, apiFetch } from './api-client';

export function useApi() {
  const { bearerToken } = useAuth();

  const request = useCallback(
    <T = unknown>(path: string, options: ApiFetchOptions = {}) =>
      apiFetch<T>(path, { ...options, bearerToken }),
    [bearerToken],
  );

  return useMemo(
    () => ({
      bearerToken,
      request,
      get: <T = unknown>(path: string, options?: ApiFetchOptions) =>
        request<T>(path, { ...options, method: 'GET' }),
      post: <T = unknown>(
        path: string,
        json?: unknown,
        options?: ApiFetchOptions,
      ) => request<T>(path, { ...options, method: 'POST', json }),
      put: <T = unknown>(
        path: string,
        json?: unknown,
        options?: ApiFetchOptions,
      ) => request<T>(path, { ...options, method: 'PUT', json }),
      patch: <T = unknown>(
        path: string,
        json?: unknown,
        options?: ApiFetchOptions,
      ) => request<T>(path, { ...options, method: 'PATCH', json }),
      delete: <T = unknown>(path: string, options?: ApiFetchOptions) =>
        request<T>(path, { ...options, method: 'DELETE' }),
    }),
    [bearerToken, request],
  );
}
