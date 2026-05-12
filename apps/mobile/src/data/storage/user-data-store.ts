import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENT_SEEDS } from '../seeds';
import type { UserData } from '../types';

const USER_DATA_PREFIX = 'staff-hero:user:';

function createStorageKey(userId: string) {
  return `${USER_DATA_PREFIX}${userId}`;
}

function createDefaultUserData(userId: string): UserData {
  const now = new Date().toISOString();

  const achievements = Object.fromEntries(
    ACHIEVEMENT_SEEDS.map((achievement) => [
      achievement.id,
      {
        isUnlocked: false,
      },
    ]),
  );

  return {
    profile: {
      id: userId,
      username: null,
      is_anonymous: true,
      golden_note_shards: 0,
      preferred_instrument: null,
      skill_level: null,
      onboarding_completed: false,
      created_at: now,
      updated_at: now,
    },
    challenges: {},
    achievements,
    currency: {
      transactions: [],
    },
    equipment: {},
    instruments: {},
    analytics: {
      sessions: [],
    },
  };
}

export async function ensureUserData(userId: string): Promise<UserData> {
  const key = createStorageKey(userId);
  const existing = await AsyncStorage.getItem(key);

  if (existing) {
    return JSON.parse(existing) as UserData;
  }

  const defaults = createDefaultUserData(userId);
  await AsyncStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
}

export async function getUserData(userId: string): Promise<UserData> {
  return ensureUserData(userId);
}

export async function setUserData(
  userId: string,
  data: UserData,
): Promise<UserData> {
  const key = createStorageKey(userId);
  const updated = {
    ...data,
    profile: {
      ...data.profile,
      updated_at: new Date().toISOString(),
    },
  } satisfies UserData;

  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export async function updateUserData(
  userId: string,
  updater: (data: UserData) => void | UserData,
): Promise<UserData> {
  const current = await getUserData(userId);
  const result = updater(current);
  const next = (result as UserData | void) ?? current;
  return setUserData(userId, next);
}

export async function clearUserData(userId: string): Promise<void> {
  await AsyncStorage.removeItem(createStorageKey(userId));
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
