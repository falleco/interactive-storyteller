import AsyncStorage from '@react-native-async-storage/async-storage';
import { describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENT_SEEDS } from '~/data/seeds';
import {
  clearUserData,
  ensureUserData,
  getUserData,
  updateUserData,
} from '~/data/storage/user-data-store';

const getAsyncStorageStore = () =>
  (AsyncStorage as unknown as {
    __getStore: () => Map<string, string>;
  }).__getStore();

describe('user-data-store', () => {
  it('initialises default user data with achievements', async () => {
    const userId = 'user-defaults';

    const data = await ensureUserData(userId);

    expect(data.profile.id).toBe(userId);
    expect(data.analytics.sessions).toHaveLength(0);
    expect(Object.keys(data.achievements)).toHaveLength(ACHIEVEMENT_SEEDS.length);
    expect(getAsyncStorageStore().has(`staff-hero:user:${userId}`)).toBe(true);
  });

  it('updates user data through the updater and refreshes timestamps', async () => {
    const userId = 'user-update';

    vi.useFakeTimers();
    try {
      const initialTime = new Date('2024-01-01T00:00:00.000Z');
      vi.setSystemTime(initialTime);
      await ensureUserData(userId);

      const updatedTime = new Date('2024-01-02T12:00:00.000Z');
      vi.setSystemTime(updatedTime);

      await updateUserData(userId, (current) => {
        current.profile.username = 'Maestro';
      });

      const stored = await getUserData(userId);
      expect(stored.profile.username).toBe('Maestro');
      expect(stored.profile.updated_at).toBe(updatedTime.toISOString());
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes stored user data when cleared', async () => {
    const userId = 'user-clear';
    await ensureUserData(userId);

    await clearUserData(userId);

    await expect(
      AsyncStorage.getItem(`staff-hero:user:${userId}`),
    ).resolves.toBeNull();
    expect(getAsyncStorageStore().has(`staff-hero:user:${userId}`)).toBe(false);
  });
});
