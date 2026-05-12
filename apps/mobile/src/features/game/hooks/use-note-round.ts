import { useCallback, useEffect } from 'react';
import type { Note, Notes } from '~/shared/types/music';
import { convertDisplayNamesToNotes } from '~/shared/utils/music-utils';
import { validateAnswer } from '../utils/game-logic';
import { useGameContext } from './use-game-context';

interface UseNoteRoundOptions {
  onNotesReady?: (notes: Note[]) => void;
}

export interface EvaluateAnswerResult {
  normalizedAnswer: Notes[];
  correctNotes: Notes[];
  isCorrect: boolean;
}

/**
 * Shared controller logic for note-based game rounds (single note & sequence).
 * Ensures questions are generated, feeds the animation layer, and exposes
 * helpers to evaluate user answers.
 */
export function useNoteRoundController({
  onNotesReady,
}: UseNoteRoundOptions = {}) {
  const { gameLogic, gameSettings } = useGameContext();
  const currentQuestion = gameLogic.gameState.currentQuestion;
  const currentNotes = currentQuestion.notes;

  // Auto-generate a new question when the round begins.
  useEffect(() => {
    if (
      gameLogic.gameState.isGameActive &&
      currentNotes.length === 0 &&
      typeof gameLogic.generateNewQuestion === 'function'
    ) {
      gameLogic.generateNewQuestion(gameSettings.gameSettings);
    }
  }, [
    currentNotes.length,
    gameLogic,
    gameLogic.generateNewQuestion,
    gameLogic.gameState.isGameActive,
    gameSettings.gameSettings,
  ]);

  // Feed notes into the animation layer whenever the question changes.
  useEffect(() => {
    if (currentNotes.length > 0) {
      onNotesReady?.(currentNotes);
    }
  }, [currentNotes, onNotesReady]);

  const advanceToNextQuestion = useCallback(() => {
    gameLogic.nextQuestion();
    gameLogic.generateNewQuestion(gameSettings.gameSettings);
  }, [gameLogic, gameSettings.gameSettings]);

  const evaluateAnswer = useCallback(
    (answer: string | string[]): EvaluateAnswerResult => {
      const displayNames = Array.isArray(answer) ? answer : [answer];
      const normalizedAnswer = convertDisplayNamesToNotes(
        displayNames,
        gameSettings.gameSettings.notationSystem,
      );
      const correctNotes = currentNotes.map((note) => note.name);
      const isCorrect = validateAnswer(normalizedAnswer, correctNotes);

      return {
        normalizedAnswer,
        correctNotes,
        isCorrect,
      };
    },
    [currentNotes, gameSettings.gameSettings.notationSystem],
  );

  return {
    gameLogic,
    gameSettings,
    currentQuestion,
    advanceToNextQuestion,
    evaluateAnswer,
  };
}
