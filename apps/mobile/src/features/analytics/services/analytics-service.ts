import {
  addGameSession,
  clearUserAnalytics,
  getRecentSessions,
  getUserAchievements,
  getUserAnalytics,
  unlockAchievement,
} from '~/domain/analytics';
import type { GameSession, UserAnalytics } from '~/shared/types/analytics';

/**
 * Centralised analytics data access layer.
 */
export const analyticsService = {
  async getAnalytics(userId: string): Promise<UserAnalytics | null> {
    return getUserAnalytics(userId);
  },

  async addSession(userId: string, session: Omit<GameSession, 'id' | 'date'>) {
    return addGameSession(userId, session);
  },

  async getSessions(userId: string, limit = 20) {
    return getRecentSessions(userId, limit);
  },

  async getAchievements(userId: string) {
    return getUserAchievements(userId);
  },

  async unlock(userId: string, achievementId: string) {
    return unlockAchievement(userId, achievementId);
  },

  async clear(userId: string) {
    return clearUserAnalytics(userId);
  },
};

export type AnalyticsService = typeof analyticsService;
