import { useContext } from 'react';
import { GameContext } from '~/features/game/state/game-context';
import type { GameSettings } from '~/shared/types/music';
import { Difficulty, GameMode, NotationSystem } from '~/shared/types/music';

export interface UseGameSettingsReturn {
  /** Current game settings configuration */
  gameSettings: GameSettings;
  /** Update one or more game settings */
  updateSettings: (settings: Partial<GameSettings>) => void;
  /** Update the notation system (letter names or solfege) */
  updateNotationSystem: (notationSystem: NotationSystem) => void;
  /** Update the game difficulty level */
  updateDifficulty: (difficulty: Difficulty) => void;
  /** Update the game mode */
  updateGameMode: (gameMode: GameMode) => void;
  /** Toggle the visibility of note labels */
  toggleNoteLabels: () => void;
  /** Update the time limit for timed games */
  updateTimeLimit: (timeLimit?: number) => void;
  /** Reset all settings to their default values */
  resetSettings: () => void;
}

/**
 * Custom hook for managing game settings and configuration
 *
 * This hook implements all settings-related business logic:
 * - Updating notation system, difficulty, game mode
 * - Toggling note labels
 * - Managing time limits
 * - Resetting to defaults
 *
 * State is managed centrally in GameContext, this hook provides
 * the business logic and operations.
 *
 * @returns Object containing current settings and update methods
 *
 * @example
 * ```tsx
 * const {
 *   gameSettings,
 *   updateSettings,
 *   updateNotationSystem,
 *   updateDifficulty,
 *   toggleNoteLabels
 * } = useGameSettings();
 *
 * // Update multiple settings at once
 * updateSettings({
 *   difficulty: Difficulty.ADVANCED,
 *   gameMode: GameMode.SEQUENCE
 * });
 *
 * // Update individual settings
 * updateNotationSystem(NotationSystem.LETTER);
 * updateDifficulty(Difficulty.INTERMEDIATE);
 *
 * // Toggle note labels
 * toggleNoteLabels();
 * ```
 */
export function useGameSettings(): UseGameSettingsReturn {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error('useGameSettings must be used within a GameProvider');
  }

  const { gameSettings, setGameSettings } = context;

  /**
   * Updates one or more game settings
   * Merges the provided settings with the current configuration
   *
   * @param settings - Partial settings object with properties to update
   *
   * @example
   * ```tsx
   * updateSettings({
   *   difficulty: Difficulty.ADVANCED,
   *   showNoteLabels: false
   * });
   * ```
   */
  const updateSettings = (settings: Partial<GameSettings>) => {
    setGameSettings((prev) => ({ ...prev, ...settings }));
  };

  /**
   * Updates the notation system used for displaying notes
   *
   * @param notationSystem - The notation system to use (LETTER or SOLFEGE)
   *
   * @example
   * ```tsx
   * updateNotationSystem(NotationSystem.LETTER); // C, D, E, F, G, A, B
   * updateNotationSystem(NotationSystem.SOLFEGE); // Do, Re, Mi, Fa, Sol, La, Si
   * ```
   */
  const updateNotationSystem = (notationSystem: NotationSystem) => {
    setGameSettings((prev) => ({ ...prev, notationSystem }));
  };

  /**
   * Updates the game difficulty level
   * Affects the range of notes that can appear in questions
   *
   * @param difficulty - The difficulty level (BEGINNER, INTERMEDIATE, or ADVANCED)
   *
   * @example
   * ```tsx
   * updateDifficulty(Difficulty.BEGINNER);    // C4 to B5 - Basic treble clef range
   * updateDifficulty(Difficulty.INTERMEDIATE); // C3 to B5 - Extended range with ledger lines
   * updateDifficulty(Difficulty.ADVANCED);     // C3 to B6 - Full range with many ledger lines
   * ```
   */
  const updateDifficulty = (difficulty: Difficulty) => {
    setGameSettings((prev) => ({ ...prev, difficulty }));
  };

  /**
   * Updates the game mode
   * Determines the type of questions and gameplay mechanics
   *
   * @param gameMode - The game mode (SINGLE_NOTE, SEQUENCE, or RHYTHM)
   *
   * @example
   * ```tsx
   * updateGameMode(GameMode.SINGLE_NOTE); // Identify individual notes
   * updateGameMode(GameMode.SEQUENCE);    // Identify multiple notes in order
   * updateGameMode(GameMode.RHYTHM);      // Guitar Hero style timing game
   * ```
   */
  const updateGameMode = (gameMode: GameMode) => {
    setGameSettings((prev) => ({ ...prev, gameMode }));
  };

  /**
   * Toggles the visibility of note labels on the staff
   * Helpful for beginners to learn note positions
   *
   * @example
   * ```tsx
   * toggleNoteLabels(); // Switches between showing and hiding note names
   * ```
   */
  const toggleNoteLabels = () => {
    setGameSettings((prev) => ({
      ...prev,
      showNoteLabels: !prev.showNoteLabels,
    }));
  };

  /**
   * Updates the time limit for timed game modes
   *
   * @param timeLimit - Time limit in seconds, or undefined for no limit
   *
   * @example
   * ```tsx
   * updateTimeLimit(60);     // Set 60 second time limit
   * updateTimeLimit();       // Remove time limit
   * updateTimeLimit(undefined); // Remove time limit (explicit)
   * ```
   */
  const updateTimeLimit = (timeLimit?: number) => {
    setGameSettings((prev) => ({ ...prev, timeLimit }));
  };

  /**
   * Resets all settings to their default values
   * Useful for providing a "reset to defaults" option in settings
   *
   * @example
   * ```tsx
   * resetSettings(); // Resets to: Solfege, Beginner, Single Note, Labels On
   * ```
   */
  const resetSettings = () => {
    setGameSettings({
      notationSystem: NotationSystem.SOLFEGE,
      difficulty: Difficulty.BEGINNER,
      gameMode: GameMode.SINGLE_NOTE,
      showNoteLabels: true,
    });
  };

  return {
    gameSettings,
    updateSettings,
    updateNotationSystem,
    updateDifficulty,
    updateGameMode,
    toggleNoteLabels,
    updateTimeLimit,
    resetSettings,
  };
}
