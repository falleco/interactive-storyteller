import type {
  Challenge,
  ChallengeStatus,
  ChallengeType,
} from '~/shared/types/music';
import { ChallengeStatus as ChallengeStatusEnum } from '~/shared/types/music';
import { CHALLENGE_SEEDS } from '~/data/seeds';
import { getUserData, updateUserData } from '~/data/storage/user-data-store';
import { addCurrencyTransaction, getUserBalance } from '../currency/currency-repository';
import { getUserProfile } from '../user/user-profile-repository';

function ensureChallengeState(
  userId: string,
  challengeId: string,
  defaultStatus: ChallengeStatus = ChallengeStatusEnum.AVAILABLE,
) {
  return updateUserData(userId, (data) => {
    if (!data.challenges[challengeId]) {
      data.challenges[challengeId] = {
        progress: 0,
        status: defaultStatus,
        updatedAt: new Date().toISOString(),
      };
    }
  });
}

function getChallengeSeed(challengeId: string) {
  const seed = CHALLENGE_SEEDS.find((challenge) => challenge.id === challengeId);
  if (!seed) {
    throw new Error(`Challenge with id "${challengeId}" not found`);
  }
  return seed;
}

/**
 * Fetches all available challenges and the user's progress on them.
 */
export async function fetchUserChallenges(userId: string): Promise<Challenge[]> {
  await getUserProfile(userId);

  const data = await updateUserData(userId, (current) => {
    const now = new Date().toISOString();
    for (const challenge of CHALLENGE_SEEDS) {
      if (!current.challenges[challenge.id]) {
        current.challenges[challenge.id] = {
          progress: 0,
          status: ChallengeStatusEnum.AVAILABLE,
          updatedAt: now,
        };
      }
    }
  });

  return CHALLENGE_SEEDS.map((challenge) => {
    const state = data.challenges[challenge.id];

    return {
      id: challenge.id,
      type: challenge.type,
      title: challenge.title,
      description: challenge.description,
      icon: challenge.icon,
      requirement: challenge.requirement,
      reward: challenge.reward,
      progress: state?.progress ?? 0,
      status: state?.status ?? ChallengeStatusEnum.AVAILABLE,
      targetRoute: challenge.targetRoute ?? undefined,
    } satisfies Challenge;
  });
}

/**
 * Starts a challenge for a user.
 */
export async function startChallenge(
  userId: string,
  challengeId: string,
): Promise<void> {
  await ensureChallengeState(userId, challengeId, ChallengeStatusEnum.IN_PROGRESS);

  await updateUserData(userId, (data) => {
    const state = data.challenges[challengeId];
    if (state.status !== ChallengeStatusEnum.REDEEMED) {
      state.status = ChallengeStatusEnum.IN_PROGRESS;
      state.updatedAt = new Date().toISOString();
    }
  });
}

/**
 * Updates progress for challenges of a specific type.
 */
export async function updateChallengeProgress(
  userId: string,
  type: ChallengeType,
  amount: number,
): Promise<void> {
  const relevantChallenges = CHALLENGE_SEEDS.filter(
    (challenge) => challenge.type === type,
  );

  if (relevantChallenges.length === 0) {
    return;
  }

  await updateUserData(userId, (data) => {
    const now = new Date().toISOString();
    for (const challenge of relevantChallenges) {
      const state =
        data.challenges[challenge.id] ?? {
          progress: 0,
          status: ChallengeStatusEnum.AVAILABLE,
          updatedAt: now,
        };

      if (state.status === ChallengeStatusEnum.REDEEMED) {
        data.challenges[challenge.id] = state;
        continue;
      }

      const newProgress = Math.min(
        challenge.requirement,
        Math.max(0, state.progress + amount),
      );

      const newStatus =
        newProgress >= challenge.requirement
          ? ChallengeStatusEnum.COMPLETED
          : ChallengeStatusEnum.IN_PROGRESS;

      data.challenges[challenge.id] = {
        progress: newProgress,
        status: newStatus,
        updatedAt: now,
      };
    }
  });
}

/**
 * Sets challenge progress to a specific value (auto-sync helper).
 */
export async function setChallengeProgress(
  userId: string,
  challengeId: string,
  progress: number,
  requirement: number,
  status: ChallengeStatus,
): Promise<void> {
  const seed = getChallengeSeed(challengeId);
  const targetRequirement = requirement ?? seed.requirement;
  const clampedProgress = Math.min(Math.max(progress, 0), targetRequirement);

  await ensureChallengeState(userId, challengeId);

  await updateUserData(userId, (data) => {
    const state = data.challenges[challengeId];

    if (state.status === ChallengeStatusEnum.REDEEMED) {
      return;
    }

    state.progress = clampedProgress;
    state.status = status;
    state.updatedAt = new Date().toISOString();
  });
}

/**
 * Redeems a completed challenge and awards golden note shards.
 */
export async function redeemChallenge(
  userId: string,
  challengeId: string,
): Promise<void> {
  const seed = getChallengeSeed(challengeId);
  const data = await getUserData(userId);
  const state = data.challenges[challengeId];

  if (!state || state.status !== ChallengeStatusEnum.COMPLETED) {
    throw new Error('Challenge must be completed before redeeming');
  }

  await addCurrencyTransaction(userId, seed.reward, 'challenge_reward', {
    sourceId: challengeId,
    description: `Reward for completing "${seed.title}"`,
    metadata: {
      challengeId,
      challengeTitle: seed.title,
      reward: seed.reward,
    },
  });

  await updateUserData(userId, (userData) => {
    const updated = userData.challenges[challengeId];
    if (updated) {
      updated.status = ChallengeStatusEnum.REDEEMED;
      updated.updatedAt = new Date().toISOString();
    }
  });
}

/**
 * Adds golden note shards directly to user's account.
 */
export async function addGoldenShards(
  userId: string,
  amount: number,
  description?: string,
): Promise<void> {
  await addCurrencyTransaction(userId, amount, 'admin_adjustment', {
    description: description ?? `Added ${amount} golden note shards`,
    metadata: { amount },
  });
}

/**
 * Gets user's currency (golden note shards).
 */
export async function getUserCurrency(userId: string): Promise<number> {
  await getUserProfile(userId);
  return getUserBalance(userId, 'golden_note_shards');
}

/**
 * Resets all user challenges (for testing).
 */
export async function resetUserChallenges(userId: string): Promise<void> {
  await updateUserData(userId, (data) => {
    data.challenges = {};
    data.currency.transactions = [];
    data.profile.golden_note_shards = 0;
  });
}
