import { ACHIEVEMENT_SEEDS } from '~/data/seeds';
import { Difficulty, GameMode, NotationSystem } from './music';

export interface GameSession {
  id: string;
  date: string;
  gameMode: GameMode;
  difficulty: Difficulty;
  notationSystem: NotationSystem;
  score: number;
  streak: number;
  maxStreak: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  duration: number; // in seconds
}

export interface UserAnalytics {
  totalGamesPlayed: number;
  totalScore: number;
  bestStreak: number;
  averageAccuracy: number;
  totalPlayTime: number; // in seconds
  favoriteGameMode: string;
  favoriteNotation: string;
  favoriteDifficulty: string;
  gamesPerMode: {
    [GameMode.SINGLE_NOTE]: number;
    [GameMode.SEQUENCE]: number;
    [GameMode.RHYTHM]: number;
  };
  gamesPerNotation: {
    [NotationSystem.LETTER]: number;
    [NotationSystem.SOLFEGE]: number;
  };
  gamesPerDifficulty: {
    [Difficulty.BEGINNER]: number;
    [Difficulty.INTERMEDIATE]: number;
    [Difficulty.ADVANCED]: number;
  };
  recentSessions: GameSession[];
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export const ACHIEVEMENTS: Achievement[] = ACHIEVEMENT_SEEDS.map((seed) => ({
  id: seed.id,
  title: seed.title,
  description: seed.description,
  icon: seed.icon,
  isUnlocked: false,
}));
