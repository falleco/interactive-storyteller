import { useCallback, useEffect, useState } from 'react';
import { useApi } from '~/shared/api';
import type { Language, Storyteller } from './types';

interface UseStorytellersResult {
  storytellers: Storyteller[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useStorytellers(language: Language): UseStorytellersResult {
  const api = useApi();
  const [storytellers, setStorytellers] = useState<Storyteller[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.get<Storyteller[]>(
        `/storytellers?language=${language}`,
      );
      setStorytellers(list);
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error('Failed to load storytellers'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [api, language]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { storytellers, isLoading, error, refresh };
}
