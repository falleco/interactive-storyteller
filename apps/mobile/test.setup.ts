import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom/vitest';

const asyncStorageStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => {
  const getItem = vi.fn(async (key: string) => asyncStorageStore.get(key) ?? null);
  const setItem = vi.fn(async (key: string, value: string) => {
    asyncStorageStore.set(key, value);
  });
  const removeItem = vi.fn(async (key: string) => {
    asyncStorageStore.delete(key);
  });
  const clear = vi.fn(async () => {
    asyncStorageStore.clear();
  });

  return {
    default: {
      getItem,
      setItem,
      removeItem,
      clear,
      __getStore: () => asyncStorageStore,
    },
  };
});

afterEach(() => {
  cleanup();
  asyncStorageStore.clear();
  vi.clearAllMocks();
});
