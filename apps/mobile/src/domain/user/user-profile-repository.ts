import type { UserProfile } from '~/data/types';
import { ensureUserData, updateUserData } from '~/data/storage/user-data-store';

/**
 * Gets or creates a user profile stored in AsyncStorage.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const data = await ensureUserData(userId);
  return data.profile;
}

/**
 * Updates user profile values.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>,
): Promise<UserProfile> {
  const result = await updateUserData(userId, (data) => {
    data.profile = {
      ...data.profile,
      ...updates,
    };
  });

  return result.profile;
}
