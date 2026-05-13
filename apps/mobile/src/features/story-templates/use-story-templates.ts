import { useCallback, useEffect, useState } from 'react';
import { useApi } from '~/shared/api';
import { useAuth } from '~/shared/hooks/use-auth';
import type {
  CreateStoryTemplateInput,
  StoryTemplate,
  UpdateStoryTemplateInput,
} from './types';

export interface UseStoryTemplatesResult {
  templates: StoryTemplate[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: CreateStoryTemplateInput) => Promise<StoryTemplate>;
  update: (
    id: string,
    input: UpdateStoryTemplateInput,
  ) => Promise<StoryTemplate>;
  remove: (id: string) => Promise<void>;
}

export function useStoryTemplates(): UseStoryTemplatesResult {
  const api = useApi();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<StoryTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.get<StoryTemplate[]>('/story-templates');
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load templates'));
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CreateStoryTemplateInput) => {
      const created = await api.post<StoryTemplate>('/story-templates', input);
      setTemplates((prev) => [...prev, created]);
      return created;
    },
    [api],
  );

  const update = useCallback(
    async (id: string, input: UpdateStoryTemplateInput) => {
      const updated = await api.patch<StoryTemplate>(
        `/story-templates/${id}`,
        input,
      );
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [api],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete<void>(`/story-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [api],
  );

  return { templates, isLoading, error, refresh, create, update, remove };
}
