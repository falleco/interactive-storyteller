import type { Difficulty } from './music';

export interface NoteSymbol {
  id: string;
  name: string;
  duration: number; // in beats (4 = whole note, 2 = half note, 1 = quarter note, etc.)
  width: number;
  height: number;
  stemRequired: boolean;
}

// Note symbol definitions
export const NOTE_SYMBOLS: Record<string, NoteSymbol> = {
  semibreve: {
    id: 'semibreve',
    name: 'Whole Note (Semibreve)',
    duration: 4,
    width: 16,
    height: 10,
    stemRequired: false,
  },

  // Future note symbols can be easily added here:
  /*
  minim: {
    id: 'minim',
    name: 'Half Note (Minim)',
    duration: 2,
    pathData: "...", // Half note SVG path
    viewBox: "...",
    width: 14,
    height: 12,
    stemRequired: true,
    difficulty: 'intermediate',
  },
  
  crotchet: {
    id: 'crotchet',
    name: 'Quarter Note (Crotchet)',
    duration: 1,
    pathData: "...", // Quarter note SVG path
    viewBox: "...",
    width: 12,
    height: 14,
    stemRequired: true,
    difficulty: 'intermediate',
  },
  
  quaver: {
    id: 'quaver',
    name: 'Eighth Note (Quaver)',
    duration: 0.5,
    pathData: "...", // Eighth note SVG path
    viewBox: "...",
    width: 12,
    height: 16,
    stemRequired: true,
    difficulty: 'advanced',
  },
  */
};

// Get available note symbols based on difficulty
export function getNoteSymbolsForDifficulty(
  difficulty: Difficulty,
): NoteSymbol[] {
  const symbols = Object.values(NOTE_SYMBOLS);
  return symbols;
}

// Default note symbol for current implementation
export const DEFAULT_NOTE_SYMBOL = NOTE_SYMBOLS.semibreve;
