import { useCallback, useContext } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { analyticsService } from '~/features/analytics/services/analytics-service';
import { GameContext } from '~/features/game/state/game-context';
import type { GameSession, UserAnalytics } from '~/shared/types/analytics';

export interface UseAnalyticsReturn {
  analytics: UserAnalytics | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  addSession: (session: Omit<GameSession, 'id' | 'date'>) => Promise<string>;
  getRecentSessions: (limit?: number) => Promise<GameSession[]>;
  getUserAchievements: () => Promise<UserAnalytics['achievements']>;
  unlockAchievement: (achievementId: string) => Promise<boolean>;
  clearData: () => Promise<void>;
}

/**
 * Hook for managing game analytics
 *
 * This hook provides access to analytics state from GameContext and exposes
 * business logic functions for managing game sessions and achievements.
 *
 * Architecture:
 * - State is stored in GameContext (centralized)
 * - Business logic is in this hook
 * - Components use this hook, not the context directly
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { analytics, isLoading, addSession } = useAnalytics();
 *
 *   const handleGameEnd = async () => {
 *     await addSession({
 *       gameMode: GameMode.SINGLE_NOTE,
 *       difficulty: Difficulty.BEGINNER,
 *       notationSystem: NotationSystem.LETTER,
 *       score: 450,
 *       streak: 8,
 *       maxStreak: 12,
 *       totalQuestions: 20,
 *       correctAnswers: 18,
 *       accuracy: 90,
 *       duration: 180,
 *     });
 *   };
 *
 *   return (
 *     <View>
 *       {isLoading ? (
 *         <Loading />
 *       ) : (
 *         <Text>Total Games: {analytics?.totalGamesPlayed}</Text>
 *       )}
 *     </View>
 *   );
 * }
 * ```
 */
export function useAnalytics(): UseAnalyticsReturn {
  const context = useContext(GameContext);
  const { user } = useAuth();

  if (!context) {
    throw new Error('useAnalytics must be used within a GameProvider');
  }

  const { analytics, analyticsLoading, setAnalytics, setAnalyticsLoading } =
    context;

  /**
   * Refreshes analytics data from local storage
   */
  const refresh = useCallback(async () => {
    if (!user) return;

    try {
      setAnalyticsLoading(true);
      const fetchedAnalytics = await analyticsService.getAnalytics(user.id);
      setAnalytics(fetchedAnalytics);
    } catch (error) {
      console.error('Error refreshing analytics:', error);
      throw error;
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user, setAnalytics, setAnalyticsLoading]);

  /**
   * Adds a game session to local storage
   * Automatically checks for achievement unlocks
   * Refreshes analytics after adding
   *
   * @param session - Game session data (without id and date)
   * @returns Session ID
   */
  const addSession = useCallback(
    async (session: Omit<GameSession, 'id' | 'date'>): Promise<string> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        // Add session to database (auto-checks achievements)
        const sessionId = await analyticsService.addSession(user.id, session);

        // Refresh analytics to reflect new session
        await refresh();

        return sessionId;
      } catch (error) {
        console.error('Error adding game session:', error);
        throw error;
      }
    },
    [user, refresh],
  );

  /**
   * Gets recent game sessions for the user
   *
   * @param limit - Number of sessions to fetch (default: 20)
   * @returns Array of recent game sessions
   */
  const getRecentSessions = useCallback(
    async (limit = 20): Promise<GameSession[]> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        return await analyticsService.getSessions(user.id, limit);
      } catch (error) {
        console.error('Error getting recent sessions:', error);
        throw error;
      }
    },
    [user],
  );

  /**
   * Gets all achievements with unlock status for the user
   *
   * @returns Array of achievements
   */
  const getUserAchievements = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      return await analyticsService.getAchievements(user.id);
    } catch (error) {
      console.error('Error getting user achievements:', error);
      throw error;
    }
  }, [user]);

  /**
   * Manually unlocks an achievement for the user
   * Refreshes analytics after unlocking
   *
   * @param achievementId - ID of achievement to unlock
   * @returns true if newly unlocked, false if already unlocked
   */
  const unlockAchievement = useCallback(
    async (achievementId: string): Promise<boolean> => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      try {
        const unlocked = await analyticsService.unlock(user.id, achievementId);

        // Refresh analytics if achievement was newly unlocked
        if (unlocked) {
          await refresh();
        }

        return unlocked;
      } catch (error) {
        console.error('Error unlocking achievement:', error);
        throw error;
      }
    },
    [user, refresh],
  );

  /**
   * Clears all analytics data for the user
   * Deletes all game sessions and achievements
   * Refreshes analytics after clearing
   */
  const clearData = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      await analyticsService.clear(user.id);

      // Refresh analytics to reflect cleared state
      await refresh();
    } catch (error) {
      console.error('Error clearing analytics:', error);
      throw error;
    }
  }, [user, refresh]);

  return {
    analytics,
    isLoading: analyticsLoading,
    refresh,
    addSession,
    getRecentSessions,
    getUserAchievements,
    unlockAchievement,
    clearData,
  };
}
