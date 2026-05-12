// Musical notes enum
export enum Notes {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
}

// Legacy type alias for backward compatibility during transition
export type NoteName = Notes;

export type SolfegeName = 'Do' | 'Re' | 'Mi' | 'Fa' | 'Sol' | 'La' | 'Si';

// Notation system enum
export enum NotationSystem {
  LETTER = 'letter',
  SOLFEGE = 'solfege',
}

// Game mode enum
export enum GameMode {
  SINGLE_NOTE = 'single-note',
  SEQUENCE = 'sequence',
  RHYTHM = 'rhythm',
}

// Difficulty enum
export enum Difficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

// Note animation and state types
export enum NoteState {
  IDLE = 'idle',
  HIGHLIGHTED = 'highlighted',
  CORRECT = 'correct',
  INCORRECT = 'incorrect',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
}

export enum NoteAnimationType {
  CREATION = 'creation',
  DESTRUCTION = 'destruction',
  FEEDBACK = 'feedback',
}

export interface NoteAnimation {
  type: NoteAnimationType;
  isCorrect?: boolean;
  onComplete?: () => void;
}

export interface Note {
  name: NoteName;
  octave: number;
  // Position on the staff (0 = middle line, negative = below, positive = above)
  staffPosition: number;
  // Duration of the note (4 = whole note, 2 = half note, 1 = quarter note, etc.)
  duration: number;
  // Note symbol type (for different note durations)
  symbolId?: string;
  // Note state for animations and feedback
  state?: NoteState;
  // Animation to trigger
  animation?: NoteAnimation;
  // Unique identifier for tracking individual notes
  noteId?: string;
}

export interface GameSettings {
  notationSystem: NotationSystem;
  difficulty: Difficulty;
  gameMode: GameMode;
  showNoteLabels: boolean; // Helper for beginners
  timeLimit?: number; // in seconds
}

export interface GameState {
  score: number;
  streak: number;
  maxStreak: number;
  totalQuestions: number;
  correctAnswers: number;
  currentQuestion: Question;
  isGameActive: boolean;
  timeRemaining?: number;
}

export interface Question {
  id: string;
  notes: Note[];
  options: string[];
  answered: boolean;
  userAnswer?: Notes[];
  // For rhythm mode
  noteTimings?: number[]; // When each note should be played (in ms)
  userTimings?: number[]; // When user actually pressed (in ms)
}

export interface ScoreHistory {
  date: string;
  score: number;
  streak: number;
  accuracy: number;
  gameMode: GameMode;
  difficulty: Difficulty;
}

// Challenge system types
export enum ChallengeType {
  DOMINATE_NOTES = 'dominate-notes',
  SCORE_POINTS = 'score-points',
  BATTLE_COUNT = 'battle-count',
}

export enum ChallengeStatus {
  AVAILABLE = 'available',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  REDEEMED = 'redeemed',
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  icon: string;
  requirement: number;
  progress: number;
  reward: number; // Golden note shards
  status: ChallengeStatus;
  targetRoute?: string; // Where to navigate when user clicks "Go"
}

export type OnboardingInstrument =
  | 'violin'
  | 'viola'
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'bass';

export type SkillLevel = 'beginner' | 'intermediate' | 'pro';
export interface UserCurrency {
  goldenNoteShards: number;
}

// Instrument system types
export enum InstrumentType {
  VIOLIN = 'violin',
  VIOLA = 'viola',
  ACOUSTIC_GUITAR = 'acoustic_guitar',
  ELECTRIC_GUITAR = 'electric_guitar',
  BASS = 'bass',
}

export enum InstrumentRarity {
  APPRENTICE = 'apprentice',
  NORMAL = 'normal',
  PRO = 'pro',
  EPIC = 'epic',
}

export interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  rarity: InstrumentRarity;
  level: number;
  tuning: number; // 0-100, affects accuracy bonus
  bonuses: {
    scoreMultiplier: number;
    accuracyBonus: number;
    streakBonus: number;
  };
  price: number; // Cost in golden note shards
  upgradePrice: number; // Cost to upgrade
  tunePrice: number; // Cost to tune
  icon: string;
  description: string;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface LuthierService {
  id: string;
  name: string;
  description: string;
  icon: string;
  basePrice: number;
  type: 'tune' | 'buy' | 'upgrade';
}

// Equipment system types
export enum EquipmentCategory {
  MANTLE = 'mantle',
  ADORNMENTS = 'adornments',
  INSTRUMENTS = 'instruments',
}

export enum EquipmentRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  rarity: EquipmentRarity;
  instrumentType: OnboardingInstrument | null;
  level: number;
  bonuses: {
    scoreBonus: number;
    accuracyBonus: number;
    streakBonus: number;
    specialEffect?: string;
  };
  price: number; // Cost in golden note shards
  upgradePrice: number; // Cost to upgrade
  icon: string;
  description: string;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface UserEquipment {
  mantle: Equipment | null;
  adornments: Equipment[];
  instruments: Equipment | null;
}

// Settings system types
export enum SettingActionType {
  NAVIGATION = 'navigation',
  TOGGLE = 'toggle',
  SELECTION = 'selection',
  ACTION = 'action',
  EXTERNAL_LINK = 'external-link',
}

export interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  actionType: SettingActionType;
  route?: string; // For navigation
  options?: { label: string; value: any; description?: string }[]; // For selection
  currentValue?: any; // Current selected value
  onPress?: () => void; // For actions
  externalUrl?: string; // For external links
  isEnabled?: boolean; // For toggles
  isDangerous?: boolean; // For danger zone items
}

export interface SettingSection {
  id: string;
  title: string;
  items: SettingItem[];
}

export interface AppSettings {
  // Account
  username: string;
  isConnected: boolean;

  // Gameplay (already exists in GameSettings)

  // General
  pushNotifications: {
    enabled: boolean;
    challenges: boolean;
    achievements: boolean;
    dailyReminders: boolean;
  };
  soundAndVibrations: {
    soundEffects: boolean;
    music: boolean;
    hapticFeedback: boolean;
    volume: number; // 0-100
  };
  graphics: {
    quality: 'low' | 'medium' | 'high';
    animations: boolean;
    particleEffects: boolean;
    frameRate: 30 | 60;
  };
  networking: {
    autoSync: boolean;
    wifiOnly: boolean;
    backgroundSync: boolean;
  };
}

// Notation display mappings - each notation system maps Notes enum to display names
export const NOTATION_MAPPINGS = {
  [NotationSystem.LETTER]: {
    [Notes.A]: 'A',
    [Notes.B]: 'B',
    [Notes.C]: 'C',
    [Notes.D]: 'D',
    [Notes.E]: 'E',
    [Notes.F]: 'F',
    [Notes.G]: 'G',
  },
  [NotationSystem.SOLFEGE]: {
    [Notes.A]: 'La',
    [Notes.B]: 'Si',
    [Notes.C]: 'Do',
    [Notes.D]: 'Re',
    [Notes.E]: 'Mi',
    [Notes.F]: 'Fa',
    [Notes.G]: 'Sol',
  },
} as const;

// Legacy mapping for backward compatibility during transition
export const NOTE_MAPPINGS: Record<NotationSystem, Record<NoteName, string>> = {
  [NotationSystem.LETTER]: {
    C: 'C',
    D: 'D',
    E: 'E',
    F: 'F',
    G: 'G',
    A: 'A',
    B: 'B',
  },
  [NotationSystem.SOLFEGE]: {
    C: 'Do',
    D: 'Re',
    E: 'Mi',
    F: 'Fa',
    G: 'Sol',
    A: 'La',
    B: 'Si',
  },
};

// Staff positions for treble clef (E4 bottom line = 0) - NO DUPLICATES!
// Traditional treble clef: Lines are E-G-B-D-F, Spaces are F-A-C-E
export const TREBLE_CLEF_POSITIONS: Record<string, number> = {
  // 3 ledger lines above staff
  E6: 14, // 3rd ledger line above
  D6: 13, // 2nd ledger line above
  C6: 12, // 2nd ledger line above
  B5: 11, // Space above 2nd ledger line
  A5: 10, // 2nd ledger line above
  G5: 9, // Space above 1st ledger line

  // Main staff (traditional treble clef - EGBDF lines, FACE spaces)
  F5: 8, // 5th line (top line) - Fa
  E5: 7, // 4th space - Mi
  D5: 6, // 4th line - Re
  C5: 5, // 3rd space - Do
  B4: 4, // 3rd line - Si
  A4: 3, // 2nd space - La
  G4: 2, // 2nd line - Sol (treble clef reference)
  F4: 1, // 1st space - Fa
  E4: 0, // 1st line (bottom line) - Mi ← BOTTOM LINE!

  // 3 ledger lines below staff
  D4: -1, // Space below staff
  C4: -2, // 1st ledger line below (middle C)
  B3: -3, // Space below 1st ledger line
  A3: -4, // 2nd ledger line below
  G3: -5, // Space below 2nd ledger line
  F3: -6, // 3rd ledger line below
};

// Staff position to note name mapping for labels (consistent with TREBLE_CLEF_POSITIONS)
export const STAFF_POSITION_TO_NOTE: Record<
  number,
  { letter: Notes; octave: number }
> = {
  // 3 ledger lines above staff
  14: { letter: Notes.E, octave: 6 }, // E6 - 2nd ledger line above
  13: { letter: Notes.D, octave: 6 }, // D6- Space above 2nd ledger line
  12: { letter: Notes.C, octave: 6 }, // C6 - 2nd ledger line above
  11: { letter: Notes.B, octave: 5 }, // B5 - Space above 2nd ledger line
  10: { letter: Notes.A, octave: 5 }, // A5 - 21st ledger line above
  9: { letter: Notes.G, octave: 5 }, // G5 - Space above 1st ledger line

  // Main staff (traditional treble clef)
  8: { letter: Notes.F, octave: 5 }, // F5 - 5th line (top line) - Fa
  7: { letter: Notes.E, octave: 5 }, // E5 - 4th space - Mi
  6: { letter: Notes.D, octave: 5 }, // D5 - 4th line - Re
  5: { letter: Notes.C, octave: 5 }, // C5 - 3rd space - Do
  4: { letter: Notes.B, octave: 4 }, // B4 - 3rd line - Si
  3: { letter: Notes.A, octave: 4 }, // A4 - 2nd space - La
  2: { letter: Notes.G, octave: 4 }, // G4 - 2nd line - Sol (treble clef reference)
  1: { letter: Notes.F, octave: 4 }, // F4 - 1st space - Fa
  0: { letter: Notes.E, octave: 4 }, // E4 - 1st line (bottom line) - Mi ← BOTTOM LINE!

  // 3 ledger lines below staff
  [-1]: { letter: Notes.D, octave: 4 }, // D4 - Space below staff
  [-2]: { letter: Notes.C, octave: 4 }, // C4 - 1st ledger line below (middle C)
  [-3]: { letter: Notes.B, octave: 3 }, // B3 - Space below 1st ledger line
  [-4]: { letter: Notes.A, octave: 3 }, // A3 - 2nd ledger line below
  [-5]: { letter: Notes.G, octave: 3 }, // G3 - Space below 2nd ledger line
  [-6]: { letter: Notes.F, octave: 3 }, // F3 - 3rd ledger line below
};

export const STAFF_LINE_COUNT = 5;
export const STAFF_SPACE_COUNT = 4;
