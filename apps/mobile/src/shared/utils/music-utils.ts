/**
 * Music Utilities
 *
 * Core utilities for music note generation, question creation, and game logic.
 * This module handles the fundamental music theory and note positioning logic.
 */

import {
  Difficulty,
  GameMode,
  type GameSettings,
  NOTATION_MAPPINGS,
  type NotationSystem,
  type Note,
  type NoteName,
  Notes,
  type Question,
  TREBLE_CLEF_POSITIONS,
} from '~/shared/types/music';
import {
  DEFAULT_NOTE_SYMBOL,
  getNoteSymbolsForDifficulty,
} from '~/shared/types/note-symbols';

/**
 * Reverse mapping from staff position to note for accurate conversion
 * Built dynamically from TREBLE_CLEF_POSITIONS to ensure consistency
 */
const POSITION_TO_NOTE: Record<number, { name: Notes; octave: number }> = {};
Object.entries(TREBLE_CLEF_POSITIONS).forEach(([noteKey, position]) => {
  const name = noteKey.slice(0, -1) as Notes;
  const octave = Number.parseInt(noteKey.slice(-1));
  POSITION_TO_NOTE[position] = { name, octave };
});

/**
 * Generates a random note within the treble clef range
 * @param difficulty - Game difficulty level affecting note range
 * @returns A randomly generated note with proper staff positioning
 */
export function generateRandomNote(
  difficulty: Difficulty = Difficulty.BEGINNER,
): Note {
  // Use the available positions from TREBLE_CLEF_POSITIONS for consistency
  const availablePositions = Object.values(TREBLE_CLEF_POSITIONS);
  const randomPosition =
    availablePositions[Math.floor(Math.random() * availablePositions.length)];

  const noteInfo = POSITION_TO_NOTE[randomPosition];
  if (!noteInfo) {
    // Fallback to a safe note
    return {
      name: Notes.C,
      octave: 5,
      staffPosition: 1,
      duration: DEFAULT_NOTE_SYMBOL.duration,
      symbolId: DEFAULT_NOTE_SYMBOL.id,
      noteId: `C5_1_${Date.now()}_${Math.random()}`,
    };
  }

  // Get available note symbols for the difficulty level
  const availableSymbols = getNoteSymbolsForDifficulty(difficulty);
  const randomSymbol =
    availableSymbols[Math.floor(Math.random() * availableSymbols.length)];

  return {
    name: noteInfo.name,
    octave: noteInfo.octave,
    staffPosition: randomPosition,
    duration: randomSymbol.duration,
    symbolId: randomSymbol.id,
    noteId: `${noteInfo.name}${noteInfo.octave}_${randomPosition}_${Date.now()}_${Math.random()}`,
  };
}

/**
 * Generates multiple random notes for multi-note game modes
 * @param count - Number of notes to generate
 * @param difficulty - Game difficulty level
 * @returns Array of randomly generated notes
 */
export function generateRandomNotes(
  count: number,
  difficulty: Difficulty = Difficulty.BEGINNER,
): Note[] {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    notes.push(generateRandomNote(difficulty));
  }
  return notes;
}

// Convert note name to display string based on notation system
export function getNoteDisplayName(
  noteName: NoteName,
  notationSystem: NotationSystem,
): string {
  return NOTATION_MAPPINGS[notationSystem][noteName as Notes];
}

/**
 * Converts display string back to Notes enum value
 * @param displayName - The display name (e.g., "Do", "C")
 * @param notationSystem - The notation system being used
 * @returns The corresponding Notes enum value
 */
export function getNotesFromDisplayName(
  displayName: string,
  notationSystem: NotationSystem,
): Notes | null {
  const mapping = NOTATION_MAPPINGS[notationSystem];
  for (const [note, display] of Object.entries(mapping)) {
    if (display === displayName) {
      return note as Notes;
    }
  }
  return null;
}

/**
 * Converts array of display strings to Notes enum values
 * @param displayNames - Array of display names
 * @param notationSystem - The notation system being used
 * @returns Array of Notes enum values
 */
export function convertDisplayNamesToNotes(
  displayNames: string[],
  notationSystem: NotationSystem,
): Notes[] {
  return displayNames
    .map((name) => getNotesFromDisplayName(name, notationSystem))
    .filter((note): note is Notes => note !== null);
}

/**
 * Checks if a staff position requires ledger lines
 * @param staffPosition - The position on the staff
 * @returns True if ledger lines are required
 */
export function requiresLedgerLines(staffPosition: number): boolean {
  return Math.abs(staffPosition) > 4;
}

/**
 * Calculates if the user's answer is correct by comparing with question notes
 * @param question - The current question
 * @returns True if the user's answer matches the expected notes
 */
export function isAnswerCorrect(question: Question): boolean {
  if (!question.userAnswer || question.userAnswer.length === 0) {
    return false;
  }

  const correctNotes = question.notes.map((note) => note.name);
  const userNotes = question.userAnswer;

  return (
    JSON.stringify(userNotes.sort()) === JSON.stringify(correctNotes.sort())
  );
}

// Generate all 7 note options (always show all notes for selection)
export function generateAllNoteOptions(
  notationSystem: NotationSystem,
): string[] {
  const allNotes: Notes[] = [
    Notes.C,
    Notes.D,
    Notes.E,
    Notes.F,
    Notes.G,
    Notes.A,
    Notes.B,
  ];
  return allNotes.map((note) => NOTATION_MAPPINGS[notationSystem][note]);
}

// Generate a complete question based on game settings
export function generateQuestion(settings: GameSettings): Question {
  const noteCount =
    settings.gameMode === GameMode.SINGLE_NOTE
      ? 1
      : settings.gameMode === GameMode.SEQUENCE
        ? Math.floor(Math.random() * 6) + 2
        : // 2-4 notes
          settings.gameMode === GameMode.RHYTHM
          ? Math.floor(Math.random() * 4) + 3
          : // 3-6 notes
            1;

  const notes = generateRandomNotes(noteCount, settings.difficulty);

  // Always show all 7 note options for selection
  const allOptions = generateAllNoteOptions(settings.notationSystem);

  const question: Question = {
    id: `question_${Date.now()}_${Math.random()}`,
    notes,
    options: allOptions,
    answered: false,
  };

  // Add mode-specific properties
  if (settings.gameMode === GameMode.RHYTHM) {
    question.noteTimings = notes.map((_, index) => (index + 1) * 1000); // Notes every second
    question.userTimings = [];
  }

  return question;
}

// Calculate accuracy percentage
export function calculateAccuracy(
  correctAnswers: number,
  totalQuestions: number,
): number {
  if (totalQuestions === 0) return 0;
  return Math.round((correctAnswers / totalQuestions) * 100);
}

// Get difficulty-based note range
export function getDifficultyNoteRange(difficulty: Difficulty): {
  minOctave: number;
  maxOctave: number;
} {
  switch (difficulty) {
    case Difficulty.BEGINNER:
      return { minOctave: 4, maxOctave: 5 }; // C4 to B5
    case Difficulty.INTERMEDIATE:
      return { minOctave: 3, maxOctave: 5 }; // C3 to B5
    case Difficulty.ADVANCED:
      return { minOctave: 3, maxOctave: 6 }; // C3 to B6
    default:
      return { minOctave: 4, maxOctave: 5 };
  }
}

// Get the color for visual feedback
export function getFeedbackColor(isCorrect: boolean): string {
  return isCorrect ? '#4CAF50' : '#F44336'; // Green for correct, red for incorrect
}

// Format time remaining for display
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
