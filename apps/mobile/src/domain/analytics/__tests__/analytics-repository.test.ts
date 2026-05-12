import { describe, expect, it, vi } from 'vitest';
import { addGameSession, clearUserAnalytics, getRecentSessions, getUserAnalytics } from '~/domain/analytics';
import { ensureUserData, getUserData } from '~/data/storage/user-data-store';
import { Difficulty, GameMode, NotationSystem } from '~/shared/types/music';

const baseSession = {
  gameMode: GameMode.SINGLE_NOTE,
  difficulty: Difficulty.BEGINNER,
  notationSystem: NotationSystem.LETTER,
  score: 850,
  streak: 7,
  maxStreak: 7,
  totalQuestions: 12,
  correctAnswers: 11,
  accuracy: 92,
  duration: 180,
};

describe('analytics repository', () => {
  it('aggregates sessions and unlocks automatic achievements', async () => {
    const userId = 'analytics-user';
    await ensureUserData(userId);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-02-01T10:00:00.000Z'));
      await addGameSession(userId, baseSession);

      vi.setSystemTime(new Date('2024-02-02T10:00:00.000Z'));
      await addGameSession(userId, {
        ...baseSession,
        notationSystem: NotationSystem.SOLFEGE,
        score: 940,
        streak: 12,
        maxStreak: 12,
        accuracy: 100,
        correctAnswers: 12,
      });
    } finally {
      vi.useRealTimers();
    }

    const analytics = await getUserAnalytics(userId);
    const userData = await getUserData(userId);

    expect(analytics.totalGamesPlayed).toBe(2);
    expect(analytics.totalScore).toBe(1790);
    expect(analytics.bestStreak).toBe(12);
    expect(analytics.gamesPerMode[GameMode.SINGLE_NOTE]).toBe(2);
    expect(analytics.gamesPerNotation[NotationSystem.LETTER]).toBe(1);
    expect(analytics.gamesPerNotation[NotationSystem.SOLFEGE]).toBe(1);

    expect(userData.achievements.first_game?.isUnlocked).toBe(true);
    expect(userData.achievements.streak_5?.isUnlocked).toBe(true);
    expect(userData.achievements.streak_10?.isUnlocked).toBe(true);
    expect(userData.achievements.perfect_game?.isUnlocked).toBe(true);
    expect(userData.achievements.notation_master?.isUnlocked).toBe(true);

    const sessions = await getRecentSessions(userId, 2);
    expect(sessions[0].notationSystem).toBe(NotationSystem.SOLFEGE);
    expect(sessions[1].notationSystem).toBe(NotationSystem.LETTER);
  });

  it('clears analytics data and resets achievements', async () => {
    const userId = 'analytics-clear';
    await ensureUserData(userId);
    await addGameSession(userId, baseSession);

    await clearUserAnalytics(userId);
    const analytics = await getUserAnalytics(userId);

    expect(analytics.totalGamesPlayed).toBe(0);
    expect(analytics.achievements.every((achievement) => !achievement.isUnlocked)).toBe(
      true,
    );
  });
});
