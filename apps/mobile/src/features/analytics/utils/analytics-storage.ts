import { analyticsService } from '~/features/analytics/services/analytics-service';
import {
  ACHIEVEMENTS,
  type GameSession,
  type UserAnalytics,
} from '~/shared/types/analytics';
import { Difficulty, GameMode, NotationSystem } from '~/shared/types/music';

const defaultAnalytics: UserAnalytics = {
  totalGamesPlayed: 0,
  totalScore: 0,
  bestStreak: 0,
  averageAccuracy: 0,
  totalPlayTime: 0,
  favoriteGameMode: GameMode.SINGLE_NOTE,
  favoriteNotation: NotationSystem.LETTER,
  favoriteDifficulty: Difficulty.BEGINNER,
  gamesPerMode: {
    [GameMode.SINGLE_NOTE]: 0,
    [GameMode.SEQUENCE]: 0,
    [GameMode.RHYTHM]: 0,
  },
  gamesPerNotation: {
    [NotationSystem.LETTER]: 0,
    [NotationSystem.SOLFEGE]: 0,
  },
  gamesPerDifficulty: {
    [Difficulty.BEGINNER]: 0,
    [Difficulty.INTERMEDIATE]: 0,
    [Difficulty.ADVANCED]: 0,
  },
  recentSessions: [],
  achievements: [...ACHIEVEMENTS],
};

/**
 * Gets user analytics from local storage
 * @param userId - User ID to get analytics for
 */
export async function getAnalytics(userId?: string): Promise<UserAnalytics> {
  if (!userId) {
    return defaultAnalytics;
  }

  try {
    const analytics = await analyticsService.getAnalytics(userId);
    return analytics ?? defaultAnalytics;
  } catch (error) {
    console.error('Error loading analytics:', error);
    return defaultAnalytics;
  }
}

/**
 * Note: saveAnalytics is not needed with AsyncStorage as analytics are automatically
 * calculated from game sessions. This function exists for backward compatibility.
 */
export async function saveAnalytics(analytics: UserAnalytics): Promise<void> {
  // Analytics are automatically calculated from sessions stored locally
  // This function is kept for backward compatibility but does nothing
  console.warn(
    'saveAnalytics is deprecated with the local analytics pipeline. Analytics are automatically calculated.',
  );
}

/**
 * Adds a game session to local storage
 * @param session - Game session data
 * @param userId - User ID to add session for
 */
export async function addGameSession(
  session: GameSession,
  userId?: string,
): Promise<UserAnalytics> {
  if (!userId) {
    return defaultAnalytics;
  }

  try {
    // Add session to storage (automatically checks for achievements)
    await analyticsService.addSession(userId, {
      gameMode: session.gameMode,
      difficulty: session.difficulty,
      notationSystem: session.notationSystem,
      score: session.score,
      streak: session.streak,
      maxStreak: session.maxStreak,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      accuracy: session.accuracy,
      duration: session.duration,
    });

    // Get updated analytics
    const analytics = await analyticsService.getAnalytics(userId);
    return analytics ?? defaultAnalytics;
  } catch (error) {
    console.error('Error adding game session:', error);
    throw error;
  }
}

/**
 * Clears all analytics data for a user
 * @param userId - User ID to clear analytics for
 */
export async function clearAnalytics(userId?: string): Promise<void> {
  if (!userId) {
    return;
  }

  try {
    await analyticsService.clear(userId);
  } catch (error) {
    console.error('Error clearing analytics:', error);
  }
}

/**
 * Formats play time from seconds to human readable format
 */
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Gets appropriate emoji for a streak value
 */
export function getStreakEmoji(streak: number): string {
  if (streak < 5) return '⚡';
  if (streak < 10) return '🔥';
  if (streak < 20) return '🔥🔥';
  return '🔥🔥🔥';
}
