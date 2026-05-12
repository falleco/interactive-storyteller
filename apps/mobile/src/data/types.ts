import type {
  ChallengeStatus,
  ChallengeType,
  OnboardingInstrument,
} from '~/shared/types/music';
import type { Difficulty, GameMode, NotationSystem } from '~/shared/types/music';
import type { GameSession } from '~/shared/types/analytics';

export interface ChallengeSeed {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  icon: string;
  requirement: number;
  reward: number;
  targetRoute?: string | null;
}

export interface AchievementSeed {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockCondition: string;
}

export interface EquipmentSeed {
  id: string;
  name: string;
  category: string;
  rarity: string;
  instrumentType: OnboardingInstrument | null;
  baseLevel: number;
  baseScoreBonus: number;
  baseAccuracyBonus: number;
  baseStreakBonus: number;
  specialEffect?: string | null;
  price: number;
  upgradePrice: number;
  icon: string;
  description: string;
}

export interface InstrumentSeed {
  id: string;
  name: string;
  type: string;
  rarity: string;
  baseLevel: number;
  baseScoreMultiplier: number;
  baseAccuracyBonus: number;
  baseStreakBonus: number;
  baseTuning: number;
  price: number;
  upgradePrice: number;
  tunePrice: number;
  icon: string;
  description: string;
}

export type CurrencyType = 'golden_note_shards';
export type TransactionSource =
  | 'challenge_reward'
  | 'purchase'
  | 'initial_balance'
  | 'admin_adjustment'
  | 'migration';

export interface CurrencyTransaction {
  id: string;
  userId: string;
  currencyType: CurrencyType;
  amount: number;
  source: TransactionSource;
  sourceId?: string;
  description?: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string | null;
  is_anonymous: boolean;
  golden_note_shards: number;
  preferred_instrument: OnboardingInstrument | null;
  skill_level: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserChallengeState {
  progress: number;
  status: ChallengeStatus;
  updatedAt: string;
}

export interface UserAchievementState {
  isUnlocked: boolean;
  unlockedAt?: string;
}

export interface UserEquipmentState {
  level: number;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface UserInstrumentState {
  level: number;
  tuning: number;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface UserAnalyticsState {
  sessions: GameSession[];
}

export interface UserData {
  profile: UserProfile;
  challenges: Record<string, UserChallengeState>;
  achievements: Record<string, UserAchievementState>;
  currency: {
    transactions: CurrencyTransaction[];
  };
  equipment: Record<string, UserEquipmentState>;
  instruments: Record<string, UserInstrumentState>;
  analytics: UserAnalyticsState;
}

export interface AchievementUnlockEvent {
  id: string;
  unlockedAt: string;
}

export interface AnalyticsSnapshot {
  totalGamesPlayed: number;
  totalScore: number;
  bestStreak: number;
  gamesPerMode: Record<GameMode, number>;
  gamesPerNotation: Record<NotationSystem, number>;
  gamesPerDifficulty: Record<Difficulty, number>;
}
