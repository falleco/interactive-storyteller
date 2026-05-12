import { describe, expect, it } from 'vitest';
import {
  addNoteToSequence,
  getSequenceButtonState,
  resetSequence,
  validateSequenceWithFeedback,
} from '../sequence-logic';

describe('sequence-logic', () => {
  describe('addNoteToSequence', () => {
    it('appends notes and advances the current index', () => {
      // given
      const initialState = { userSequence: [], currentNoteIndex: 0, isComplete: false };

      // when
      const nextState = addNoteToSequence(initialState, 'C', 3);

      // then
      expect(nextState).toEqual({
        userSequence: ['C'],
        currentNoteIndex: 1,
        isComplete: false,
      });
    });

    it('marks sequence complete once all notes are recorded', () => {
      // given
      const partialState = {
        userSequence: ['C', 'D'],
        currentNoteIndex: 2,
        isComplete: false,
      };

      // when
      const completeState = addNoteToSequence(partialState, 'E', 3);

      // then
      expect(completeState).toEqual({
        userSequence: ['C', 'D', 'E'],
        currentNoteIndex: 3,
        isComplete: true,
      });
    });
  });

  describe('resetSequence', () => {
    it('returns the pristine state', () => {
      // given
      // when
      const state = resetSequence();

      // then
      expect(state).toEqual({
        userSequence: [],
        currentNoteIndex: 0,
        isComplete: false,
      });
    });
  });

  describe('validateSequenceWithFeedback', () => {
    it('identifies correct positions, mistakes, and missed notes', () => {
      // given
      const userSequence = ['C', 'E'];
      const correctSequence = ['C', 'D', 'E'];

      // when
      const feedback = validateSequenceWithFeedback(userSequence, correctSequence);

      // then
      expect(feedback).toEqual({
        isCorrect: false,
        correctPositions: [0],
        wrongPositions: [1],
        missedNotes: ['D', 'E'],
      });
    });
  });

  describe('getSequenceButtonState', () => {
    it('returns success styling for correctly placed notes', () => {
      // given
      const userSequence = ['C'];
      const correctSequence = ['C'];
      const showFeedback = true;

      // when
      const styling = getSequenceButtonState('C', userSequence, correctSequence, showFeedback);

      // then
      expect(styling).toEqual({
        backgroundColor: '#4CAF50',
        borderColor: '#45a049',
        textColor: 'white',
      });
    });

    it('returns error styling for misplaced selections', () => {
      // given
      const userSequence = ['E'];
      const correctSequence = ['C'];
      const showFeedback = true;

      // when
      const styling = getSequenceButtonState('E', userSequence, correctSequence, showFeedback);

      // then
      expect(styling).toEqual({
        backgroundColor: '#F44336',
        borderColor: '#da190b',
        textColor: 'white',
      });
    });

    it('highlights notes that were missed by the player', () => {
      // given
      const userSequence: string[] = [];
      const correctSequence = ['C'];
      const showFeedback = true;

      // when
      const styling = getSequenceButtonState('C', userSequence, correctSequence, showFeedback);

      // then
      expect(styling).toEqual({
        backgroundColor: '#FFC107',
        borderColor: '#FF8F00',
        textColor: 'white',
      });
    });

    it('falls back to neutral styling when feedback is hidden', () => {
      // given
      const userSequence: string[] = [];
      const correctSequence: string[] = [];
      const showFeedback = false;

      // when
      const styling = getSequenceButtonState('C', userSequence, correctSequence, showFeedback);

      // then
      expect(styling).toEqual({
        backgroundColor: '#f0f0f0',
        borderColor: '#ccc',
        textColor: 'inherit',
      });
    });
  });
});
