import type { Achievement, GameSession, UserAnalytics } from '~/shared/types/analytics';
import {
  Difficulty,
  GameMode,
  NotationSystem,
} from '~/shared/types/music';
import { ACHIEVEMENT_SEEDS } from '~/data/seeds';
import {
  createId,
  getUserData,
  updateUserData,
} from '~/data/storage/user-data-store';
import { getUserProfile } from '../user/user-profile-repository';

function initialiseAchievementState(userId: string) {
  return updateUserData(userId, (data) => {
    const now = new Date().toISOString();
    for (const achievement of ACHIEVEMENT_SEEDS) {
      if (!data.achievements[achievement.id]) {
        data.achievements[achievement.id] = {
          isUnlocked: false,
          unlockedAt: undefined,
        };
      } else if (
        data.achievements[achievement.id].isUnlocked &&
        !data.achievements[achievement.id].unlockedAt
      ) {
        data.achievements[achievement.id].unlockedAt = now;
      }
    }
  });
}

function buildAchievementList(
  userData: Awaited<ReturnType<typeof getUserData>>,
): Achievement[] {
  return ACHIEVEMENT_SEEDS.map((seed) => {
    const state = userData.achievements[seed.id];
    return {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      icon: seed.icon,
      isUnlocked: state?.isUnlocked ?? false,
      unlockedAt: state?.unlockedAt,
    } satisfies Achievement;
  });
}

function calculateFavorite<T extends string>(
  counts: Record<T, number>,
  fallback: T,
): T {
  let favourite = fallback;
  let highest = -Infinity;
  for (const [key, value] of Object.entries(counts) as [T, number][]) {
    if (value > highest) {
      favourite = key;
      highest = value;
    }
  }
  return favourite;
}

function normaliseSessions(sessions: GameSession[]): GameSession[] {
  return [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function unlockAchievementState(
  userId: string,
  achievementId: string,
  unlockedAt = new Date().toISOString(),
): Promise<boolean> {
  let unlocked = false;
  return updateUserData(userId, (data) => {
    const state = data.achievements[achievementId];
    if (!state || !state.isUnlocked) {
      data.achievements[achievementId] = {
        isUnlocked: true,
        unlockedAt,
      };
      unlocked = true;
    }
  }).then(() => unlocked);
}

function evaluateAutomaticAchievements(
  userId: string,
  session: GameSession,
  totalGames: number,
  sessions: GameSession[],
): Promise<void> {
  const notationSet = new Set(sessions.map((item) => item.notationSystem));

  const unlocks: Array<() => Promise<boolean>> = [];

  if (totalGames === 1) {
    unlocks.push(() => unlockAchievementState(userId, 'first_game', session.date));
  }

  if (session.maxStreak >= 5) {
    unlocks.push(() => unlockAchievementState(userId, 'streak_5', session.date));
  }

  if (session.maxStreak >= 10) {
    unlocks.push(() => unlockAchievementState(userId, 'streak_10', session.date));
  }

  if (session.accuracy >= 100) {
    unlocks.push(() => unlockAchievementState(userId, 'perfect_game', session.date));
  }

  if (
    notationSet.has(NotationSystem.LETTER) &&
    notationSet.has(NotationSystem.SOLFEGE)
  ) {
    unlocks.push(() => unlockAchievementState(userId, 'notation_master', session.date));
  }

  if (totalGames >= 50) {
    unlocks.push(() => unlockAchievementState(userId, 'dedicated_player', session.date));
  }

  return unlocks.reduce<Promise<void>>(async (chain, unlock) => {
    await chain;
    await unlock();
  }, Promise.resolve());
}

/**
 * Adds a game session to the local store and checks for achievements.
 */
export async function addGameSession(
  userId: string,
  session: Omit<GameSession, 'id' | 'date'>,
): Promise<string> {
  await initialiseAchievementState(userId);

  const newSession: GameSession = {
    id: createId('session'),
    date: new Date().toISOString(),
    ...session,
  };

  let totalGames = 0;
  let allSessions: GameSession[] = [];

  await updateUserData(userId, (data) => {
    data.analytics.sessions = [newSession, ...data.analytics.sessions];
    totalGames = data.analytics.sessions.length;
    allSessions = data.analytics.sessions;
  });

  await evaluateAutomaticAchievements(userId, newSession, totalGames, allSessions);

  return newSession.id;
}

/**
 * Gets aggregated analytics for a user.
 */
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  await getUserProfile(userId);
  const data = await getUserData(userId);
  await initialiseAchievementState(userId);

  const sessions = normaliseSessions(data.analytics.sessions);

  const totalGamesPlayed = sessions.length;
  const totalScore = sessions.reduce((sum, item) => sum + item.score, 0);
  const bestStreak = sessions.reduce(
    (max, item) => Math.max(max, item.maxStreak),
    0,
  );
  const totalPlayTime = sessions.reduce((sum, item) => sum + item.duration, 0);
  const totalAccuracy = sessions.reduce((sum, item) => sum + item.accuracy, 0);
  const averageAccuracy =
    totalGamesPlayed > 0 ? Math.round(totalAccuracy / totalGamesPlayed) : 0;

  const gamesPerMode: Record<GameMode, number> = {
    [GameMode.SINGLE_NOTE]: 0,
    [GameMode.SEQUENCE]: 0,
    [GameMode.RHYTHM]: 0,
  };

  const gamesPerNotation: Record<NotationSystem, number> = {
    [NotationSystem.LETTER]: 0,
    [NotationSystem.SOLFEGE]: 0,
  };

  const gamesPerDifficulty: Record<Difficulty, number> = {
    [Difficulty.BEGINNER]: 0,
    [Difficulty.INTERMEDIATE]: 0,
    [Difficulty.ADVANCED]: 0,
  };

  for (const session of sessions) {
    gamesPerMode[session.gameMode] += 1;
    gamesPerNotation[session.notationSystem] += 1;
    gamesPerDifficulty[session.difficulty] += 1;
  }

  const favoriteGameMode = calculateFavorite(
    gamesPerMode,
    GameMode.SINGLE_NOTE,
  );
  const favoriteNotation = calculateFavorite(
    gamesPerNotation,
    NotationSystem.LETTER,
  );
  const favoriteDifficulty = calculateFavorite(
    gamesPerDifficulty,
    Difficulty.BEGINNER,
  );

  const achievements = buildAchievementList(data);

  return {
    totalGamesPlayed,
    totalScore,
    bestStreak,
    averageAccuracy,
    totalPlayTime,
    favoriteGameMode,
    favoriteNotation,
    favoriteDifficulty,
    gamesPerMode,
    gamesPerNotation,
    gamesPerDifficulty,
    recentSessions: sessions.slice(0, 20),
    achievements,
  };
}

/**
 * Gets recent game sessions for a user.
 */
export async function getRecentSessions(
  userId: string,
  limit = 20,
): Promise<GameSession[]> {
  const data = await getUserData(userId);
  return normaliseSessions(data.analytics.sessions).slice(0, limit);
}

/**
 * Gets aggregated totals from all stored game sessions for a user.
 */
export async function getGameSessionTotals(userId: string): Promise<{
  totalQuestions: number;
  totalCorrectAnswers: number;
}> {
  const data = await getUserData(userId);
  const sessions = data.analytics.sessions;

  return sessions.reduce(
    (acc, session) => {
      acc.totalQuestions += session.totalQuestions ?? 0;
      acc.totalCorrectAnswers += session.correctAnswers ?? 0;
      return acc;
    },
    { totalQuestions: 0, totalCorrectAnswers: 0 },
  );
}

/**
 * Gets user achievements with unlock status.
 */
export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const data = await ensureAchievementsInitialised(userId);
  return buildAchievementList(data);
}

async function ensureAchievementsInitialised(userId: string) {
  await initialiseAchievementState(userId);
  return getUserData(userId);
}

/**
 * Manually unlocks an achievement for a user.
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string,
): Promise<boolean> {
  await initialiseAchievementState(userId);
  return unlockAchievementState(userId, achievementId);
}

/**
 * Clears all analytics data for a user (for testing).
 */
export async function clearUserAnalytics(userId: string): Promise<void> {
  await updateUserData(userId, (data) => {
    data.analytics.sessions = [];
    for (const achievement of ACHIEVEMENT_SEEDS) {
      data.achievements[achievement.id] = {
        isUnlocked: false,
        unlockedAt: undefined,
      };
    }
  });
}
