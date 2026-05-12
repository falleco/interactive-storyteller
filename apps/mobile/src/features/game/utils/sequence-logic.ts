/**
 * Business logic for sequence game mode
 * Separated from UI components for better testability
 */

export interface SequenceState {
  userSequence: string[];
  currentNoteIndex: number;
  isComplete: boolean;
}

/**
 * Handles adding a note to the sequence
 * @param currentState - Current sequence state
 * @param noteName - Note to add
 * @param totalNotes - Total number of notes expected
 * @returns New sequence state
 */
export function addNoteToSequence(
  currentState: SequenceState,
  noteName: string,
  totalNotes: number,
): SequenceState {
  const newSequence = [...currentState.userSequence, noteName];
  const newIndex = currentState.currentNoteIndex + 1;

  return {
    userSequence: newSequence,
    currentNoteIndex: newIndex,
    isComplete: newSequence.length === totalNotes,
  };
}

/**
 * Resets the sequence to initial state
 * @returns Initial sequence state
 */
export function resetSequence(): SequenceState {
  return {
    userSequence: [],
    currentNoteIndex: 0,
    isComplete: false,
  };
}

/**
 * Validates a sequence answer and provides detailed feedback
 * @param userSequence - User's selected sequence
 * @param correctSequence - Correct sequence
 * @returns Validation result with detailed feedback
 */
export function validateSequenceWithFeedback(
  userSequence: string[],
  correctSequence: string[],
): {
  isCorrect: boolean;
  correctPositions: number[];
  wrongPositions: number[];
  missedNotes: string[];
} {
  const correctPositions: number[] = [];
  const wrongPositions: number[] = [];
  const missedNotes: string[] = [];

  // Check each position in user sequence
  userSequence.forEach((note, index) => {
    if (index < correctSequence.length && note === correctSequence[index]) {
      correctPositions.push(index);
    } else {
      wrongPositions.push(index);
    }
  });

  // Find notes that should have been selected but weren't
  correctSequence.forEach((note, index) => {
    if (index >= userSequence.length || userSequence[index] !== note) {
      if (!missedNotes.includes(note)) {
        missedNotes.push(note);
      }
    }
  });

  return {
    isCorrect:
      userSequence.length === correctSequence.length &&
      wrongPositions.length === 0,
    correctPositions,
    wrongPositions,
    missedNotes,
  };
}

/**
 * Gets button styling state for sequence mode
 * @param noteName - Name of the note
 * @param userSequence - Current user sequence
 * @param correctSequence - Correct sequence
 * @param showFeedback - Whether to show feedback colors
 * @returns Styling information for the button
 */
export function getSequenceButtonState(
  noteName: string,
  userSequence: string[],
  correctSequence: string[],
  showFeedback: boolean,
): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  if (showFeedback) {
    const userIndex = userSequence.indexOf(noteName);
    const correctIndex = correctSequence.indexOf(noteName);

    if (userIndex !== -1) {
      // User selected this note
      if (userIndex === correctIndex) {
        return {
          backgroundColor: '#4CAF50',
          borderColor: '#45a049',
          textColor: 'white',
        };
      }
      return {
        backgroundColor: '#F44336',
        borderColor: '#da190b',
        textColor: 'white',
      };
    }
    if (correctSequence.includes(noteName)) {
      return {
        backgroundColor: '#FFC107',
        borderColor: '#FF8F00',
        textColor: 'white',
      };
    }
  }

  return {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
    textColor: 'inherit',
  };
}
