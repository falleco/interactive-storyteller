import type {
  Note,
  NoteAnimation,
  NoteState,
  Notes,
} from '~/shared/types/music';
import { NoteAnimationType, NoteState as State } from '~/shared/types/music';

/**
 * Utility functions for managing note states and animations
 * Provides centralized logic for note lifecycle management
 */

/**
 * Creates a unique note ID for tracking individual notes
 * @param note - The note object
 * @param index - Index in the notes array
 * @returns Unique note identifier
 */
export function createNoteId(note: Note, index: number): string {
  return `${note.name}${note.octave}_${note.staffPosition}_${index}_${Date.now()}`;
}

/**
 * Prepares notes for display with initial state and IDs
 * @param notes - Array of notes to prepare
 * @returns Notes with added state and ID properties
 */
export function prepareNotesForDisplay(notes: Note[]): Note[] {
  return notes.map((note, index) => ({
    ...note,
    state: State.IDLE,
    noteId: createNoteId(note, index),
  }));
}

/**
 * Triggers creation animation for all notes
 * @param notes - Array of notes to animate
 * @returns Notes with creation animation
 */
export function triggerCreationAnimation(notes: Note[]): Note[] {
  return notes.map((note) => ({
    ...note,
    state: State.IDLE,
    animation: {
      type: NoteAnimationType.CREATION,
      onComplete: () => console.log(`Note ${note.noteId} creation complete`),
    },
  }));
}

/**
 * Triggers destruction animation for all notes
 * @param notes - Array of notes to destroy
 * @param isCorrect - Whether the answer was correct
 * @param onComplete - Callback when all animations complete
 * @returns Notes with destruction animation
 */
export function triggerDestructionAnimation(
  notes: Note[],
  isCorrect: boolean,
  onComplete?: () => void,
): Note[] {
  return notes.map((note, index) => ({
    ...note,
    state: State.DESTROYING,
    animation: {
      type: NoteAnimationType.DESTRUCTION,
      isCorrect,
      onComplete: index === notes.length - 1 ? onComplete : undefined, // Only call on last note
    },
  }));
}

/**
 * Triggers feedback animation for specific notes (for sequence mode)
 * @param notes - Array of all notes
 * @param userAnswer - User's answer array
 * @param correctAnswer - Correct answer array
 * @returns Notes with individual feedback animations
 */
export function triggerSequenceFeedback(
  notes: Note[],
  userAnswer: Notes[],
  correctAnswer: Notes[],
): Note[] {
  return notes.map((note, index) => {
    // Check if this specific note was answered correctly
    const userNote = userAnswer[index];
    const correctNote = correctAnswer[index];
    const isNoteCorrect = userNote === correctNote;

    return {
      ...note,
      state: isNoteCorrect ? State.CORRECT : State.INCORRECT,
      animation: {
        type: NoteAnimationType.FEEDBACK,
        isCorrect: isNoteCorrect,
        onComplete: () => console.log(`Note ${note.noteId} feedback complete`),
      },
    };
  });
}

/**
 * Highlights a specific note (for sequence mode progression)
 * @param notes - Array of all notes
 * @param noteIndex - Index of note to highlight
 * @returns Notes with highlighted note
 */
export function highlightNote(notes: Note[], noteIndex: number): Note[] {
  return notes.map((note, index) => ({
    ...note,
    state: index === noteIndex ? State.HIGHLIGHTED : State.IDLE,
  }));
}

/**
 * Resets all notes to idle state
 * @param notes - Array of notes to reset
 * @returns Notes in idle state
 */
export function resetNotesToIdle(notes: Note[]): Note[] {
  return notes.map((note) => ({
    ...note,
    state: State.IDLE,
    animation: undefined,
  }));
}

/**
 * Gets the color for a note based on its state
 * @param note - The note to get color for
 * @param defaultColor - Default note color
 * @returns Color string for the note
 */
export function getNoteColor(note: Note, defaultColor: string): string {
  switch (note.state) {
    case State.CORRECT:
      return '#10B981'; // Green
    case State.INCORRECT:
      return '#EF4444'; // Red
    case State.HIGHLIGHTED:
      return '#3B82F6'; // Blue
    default:
      return defaultColor;
  }
}

/**
 * Checks if any notes are currently animating
 * @param notes - Array of notes to check
 * @returns True if any note is animating
 */
export function areNotesAnimating(notes: Note[]): boolean {
  return notes.some(
    (note) =>
      note.state === State.DESTROYING ||
      note.animation?.type === NoteAnimationType.DESTRUCTION ||
      note.animation?.type === NoteAnimationType.FEEDBACK,
  );
}
