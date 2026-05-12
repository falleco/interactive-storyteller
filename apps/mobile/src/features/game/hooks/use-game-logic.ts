import { useContext } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { addGameSession } from '~/features/analytics/utils/analytics-storage';
import { challengeService } from '~/features/challenges/services/challenge-service';
import { GameContext } from '~/features/game/state/game-context';
import type { GameSession } from '~/shared/types/analytics';
import type {
  GameSettings,
  GameState,
  Notes,
  Question,
} from '~/shared/types/music';
import { ChallengeType } from '~/shared/types/music';
import { generateQuestion } from '~/shared/utils/music-utils';

// Track game session for analytics
let gameStartTime = 0;

// Game state update helpers (reducer logic moved to hook)
function startGameState(): Partial<GameState> {
  return {
    isGameActive: true,
    score: 0,
    streak: 0,
    maxStreak: 0,
    totalQuestions: 0,
    correctAnswers: 0,
  };
}

function endGameState(): Partial<GameState> {
  return {
    isGameActive: false,
    currentQuestion: {
      id: '',
      notes: [],
      options: [],
      answered: false,
    },
  };
}

function submitAnswerState(
  currentState: GameState,
  answer: Notes[],
): Partial<GameState> {
  const correctNotes = currentState.currentQuestion.notes.map(
    (note) => note.name,
  );
  const isCorrect =
    JSON.stringify(answer.sort()) === JSON.stringify(correctNotes.sort());

  const newStreak = isCorrect ? currentState.streak + 1 : 0;
  const points = isCorrect ? 10 + currentState.streak * 2 : 0;

  return {
    currentQuestion: {
      ...currentState.currentQuestion,
      answered: true,
      userAnswer: answer,
    },
    score: currentState.score + points,
    streak: newStreak,
    maxStreak: Math.max(currentState.maxStreak, newStreak),
    totalQuestions: currentState.totalQuestions + 1,
    correctAnswers: currentState.correctAnswers + (isCorrect ? 1 : 0),
  };
}

function nextQuestionState(): Partial<GameState> {
  return {
    currentQuestion: {
      id: '',
      notes: [],
      options: [],
      answered: false,
    },
  };
}

function setQuestionState(question: Question): Partial<GameState> {
  return {
    currentQuestion: question,
  };
}

function resetStreakState(): Partial<GameState> {
  return {
    streak: 0,
  };
}

export interface UseGameLogicReturn {
  /** Current game state including score, streak, and current question */
  gameState: GameState;
  /** Start a new game session and reset all counters */
  startGame: (gameSettings: GameSettings) => void;
  /** End the current game session and save analytics data */
  endGame: (gameSettings: GameSettings) => Promise<void>;
  /** Submit an answer for the current question */
  submitAnswer: (answer: Notes[]) => void;
  /** Move to the next question (clears current question) */
  nextQuestion: () => void;
  /** Reset the current streak to zero */
  resetStreak: () => void;
  /** Generate and set a new question based on current settings */
  generateNewQuestion: (gameSettings: GameSettings) => void;
}

/**
 * Custom hook for managing game logic and state
 *
 * This hook implements all game-related business logic:
 * - Starting/ending games
 * - Submitting answers and calculating scores
 * - Managing streaks and question generation
 * - Tracking challenge progress
 *
 * State is managed centrally in GameContext, this hook provides
 * the business logic and operations.
 *
 * @returns Object containing game state and action methods
 *
 * @example
 * ```tsx
 * const {
 *   gameState,
 *   startGame,
 *   endGame,
 *   submitAnswer,
 *   generateNewQuestion
 * } = useGameLogic();
 *
 * // Start a new game
 * startGame(gameSettings);
 *
 * // Submit an answer
 * submitAnswer(['Do', 'Re', 'Mi']);
 *
 * // Generate next question
 * generateNewQuestion(gameSettings);
 * ```
 */
export function useGameLogic(): UseGameLogicReturn {
  const context = useContext(GameContext);
  const { user } = useAuth();

  if (!context) {
    throw new Error('useGameLogic must be used within a GameProvider');
  }

  const { gameState, setGameState, setChallenges } = context;

  const trackChallengeProgress = async (
    type: ChallengeType,
    amount: number,
  ) => {
    if (!user) return;

    try {
      await challengeService.updateProgress(user.id, type, amount);
      const updatedChallenges = await challengeService.getUserChallenges(
        user.id,
      );
      setChallenges(updatedChallenges);
    } catch (error) {
      console.error('Error tracking challenge progress:', error);
    }
  };

  /**
   * Starts a new game session with the provided settings
   * Resets all counters and initializes game state
   *
   * @param gameSettings - Current game configuration
   */
  const startGame = (gameSettings: GameSettings) => {
    gameStartTime = Date.now();
    setGameState((prev) => ({ ...prev, ...startGameState() }));

    // Update challenge progress for battle count
    void trackChallengeProgress(ChallengeType.BATTLE_COUNT, 1);
  };

  /**
   * Ends the current game session and saves analytics data
   * Creates a game session record with performance metrics
   *
   * @param gameSettings - Current game configuration
   */
  const endGame = async (gameSettings: GameSettings) => {
    // Save game session to analytics before ending
    if (gameState.isGameActive && gameStartTime > 0) {
      const duration = Math.floor((Date.now() - gameStartTime) / 1000);
      const accuracy =
        gameState.totalQuestions > 0
          ? Math.round(
              (gameState.correctAnswers / gameState.totalQuestions) * 100,
            )
          : 0;

      const session: GameSession = {
        id: `session_${Date.now()}`,
        date: new Date().toISOString(),
        gameMode: gameSettings.gameMode,
        difficulty: gameSettings.difficulty,
        notationSystem: gameSettings.notationSystem,
        score: gameState.score,
        streak: gameState.streak,
        maxStreak: gameState.maxStreak,
        totalQuestions: gameState.totalQuestions,
        correctAnswers: gameState.correctAnswers,
        accuracy,
        duration,
      };

      try {
        await addGameSession(session);
      } catch (error) {
        console.error('Error saving game session:', error);
      }
    }

    setGameState((prev) => ({ ...prev, ...endGameState() }));
  };

  /**
   * Submits an answer for the current question
   * Calculates correctness, updates score and streak
   *
   * @param answer - Array of selected note names (Notes enum values)
   */
  const submitAnswer = (answer: Notes[]) => {
    // Log answer details for debugging
    const correctNotes = gameState.currentQuestion.notes.map(
      (note) => note.name,
    );
    const isCorrect =
      JSON.stringify(answer.sort()) === JSON.stringify(correctNotes.sort());

    setGameState((prev) => ({ ...prev, ...submitAnswerState(prev, answer) }));

    // Update challenge progress for score points
    if (isCorrect) {
      const points = 10 + gameState.streak * 2;
      void trackChallengeProgress(ChallengeType.SCORE_POINTS, points);
    }
  };

  /**
   * Moves to the next question by clearing the current question state
   * Should be called after processing the current answer
   */
  const nextQuestion = () => {
    setGameState((prev) => ({ ...prev, ...nextQuestionState() }));
  };

  /**
   * Resets the current streak counter to zero
   * Useful for penalty systems or manual streak resets
   */
  const resetStreak = () => {
    setGameState((prev) => ({ ...prev, ...resetStreakState() }));
  };

  /**
   * Generates a new question based on current game settings
   * Creates a random question appropriate for the difficulty and game mode
   *
   * @param gameSettings - Current game configuration
   */
  const generateNewQuestion = (gameSettings: GameSettings) => {
    const newQuestion = generateQuestion(gameSettings);
    setGameState((prev) => ({ ...prev, ...setQuestionState(newQuestion) }));

    // Update challenge progress for dominate notes (simplified - just playing counts)
    void trackChallengeProgress(ChallengeType.DOMINATE_NOTES, 1);
  };

  return {
    gameState,
    startGame,
    endGame,
    submitAnswer,
    nextQuestion,
    resetStreak,
    generateNewQuestion,
  };
}
