import {
  fetchUserChallenges,
  redeemChallenge,
  resetUserChallenges,
  setChallengeProgress,
  startChallenge,
  updateChallengeProgress,
} from '~/domain/challenges';
import {
  getGameSessionTotals,
  getUserAnalytics,
} from '~/domain/analytics';
import type { Challenge, ChallengeType } from '~/shared/types/music';
import {
  ChallengeStatus,
  ChallengeType as ChallengeTypeEnum,
} from '~/shared/types/music';

/**
 * Challenge service keeps persistence details isolated from UI hooks.
 */
export const challengeService = {
  /**
   * Fetch all challenges for the given user.
   */
  async getUserChallenges(userId: string): Promise<Challenge[]> {
    return fetchUserChallenges(userId);
  },

  /**
   * Mark a challenge as started.
   */
  async start(userId: string, challengeId: string) {
    return startChallenge(userId, challengeId);
  },

  /**
   * Increment progress for challenges of the provided type.
   */
  async updateProgress(userId: string, type: ChallengeType, amount: number) {
    return updateChallengeProgress(userId, type, amount);
  },

  /**
   * Synchronize challenge progress with user's overall activity.
   */
  async syncWithActivity(userId: string): Promise<Challenge[]> {
    const [challenges, analytics, totals] = await Promise.all([
      fetchUserChallenges(userId),
      getUserAnalytics(userId),
      getGameSessionTotals(userId),
    ]);

    const totalScore = analytics.totalScore ?? 0;
    const totalGames = analytics.totalGamesPlayed ?? 0;
    const totalNotes = totals.totalQuestions ?? 0;

    for (const challenge of challenges) {
      if (challenge.status === ChallengeStatus.REDEEMED) {
        continue;
      }

      let metric = 0;
      switch (challenge.type) {
        case ChallengeTypeEnum.SCORE_POINTS:
          metric = totalScore;
          break;
        case ChallengeTypeEnum.BATTLE_COUNT:
          metric = totalGames;
          break;
        case ChallengeTypeEnum.DOMINATE_NOTES:
          metric = totalNotes;
          break;
        default:
          metric = 0;
      }

      const desiredProgress = Math.min(
        challenge.requirement,
        Math.max(challenge.progress, metric),
      );

      let desiredStatus: ChallengeStatus;
      if (
        challenge.status === ChallengeStatus.COMPLETED &&
        desiredProgress < challenge.requirement
      ) {
        desiredStatus = ChallengeStatus.COMPLETED;
      } else if (desiredProgress >= challenge.requirement) {
        desiredStatus = ChallengeStatus.COMPLETED;
      } else {
        desiredStatus = ChallengeStatus.IN_PROGRESS;
      }

      if (
        challenge.status === ChallengeStatus.AVAILABLE &&
        desiredProgress === 0
      ) {
        desiredStatus = ChallengeStatus.IN_PROGRESS;
      }

      if (
        challenge.progress !== desiredProgress ||
        challenge.status !== desiredStatus
      ) {
        await setChallengeProgress(
          userId,
          challenge.id,
          desiredProgress,
          challenge.requirement,
          desiredStatus,
        );
      }
    }

    return fetchUserChallenges(userId);
  },

  /**
   * Redeem a completed challenge.
   */
  async redeem(userId: string, challengeId: string) {
    return redeemChallenge(userId, challengeId);
  },

  /**
   * Reset all challenge state for the user.
   */
  async reset(userId: string) {
    return resetUserChallenges(userId);
  },
};

export type ChallengeService = typeof challengeService;
