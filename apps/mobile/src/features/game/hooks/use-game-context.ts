import { useAnalytics } from '~/features/analytics';
import { useGameLogic } from './use-game-logic';
import { useGameSettings } from './use-game-settings';

/**
 * Hook to access game logic, settings, and analytics
 *
 * Provides access to game logic, settings, and analytics hooks.
 * This is the main hook components should use to interact with game functionality.
 *
 * @returns Object containing gameLogic, gameSettings, and analytics hooks
 * @throws Error if used outside of GameProvider
 *
 * @example
 * ```tsx
 * function GameScreen() {
 *   const { gameLogic, gameSettings, analytics } = useGameContext();
 *
 *   const handleStartGame = () => {
 *     gameLogic.startGame(gameSettings.gameSettings);
 *   };
 *
 *   const handleGameEnd = async () => {
 *     await analytics.addSession({
 *       gameMode: gameSettings.gameSettings.gameMode,
 *       difficulty: gameSettings.gameSettings.difficulty,
 *       notationSystem: gameSettings.gameSettings.notation,
 *       score: gameLogic.gameState.score,
 *       streak: gameLogic.gameState.streak,
 *       maxStreak: gameLogic.gameState.maxStreak,
 *       totalQuestions: gameLogic.gameState.totalQuestions,
 *       correctAnswers: gameLogic.gameState.correctAnswers,
 *       accuracy: Math.round((gameLogic.gameState.correctAnswers / gameLogic.gameState.totalQuestions) * 100),
 *       duration: Math.floor((Date.now() - startTime) / 1000),
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <p>Score: {gameLogic.gameState.score}</p>
 *       <p>Difficulty: {gameSettings.gameSettings.difficulty}</p>
 *       <p>Total Games: {analytics.analytics?.totalGamesPlayed}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGameContext() {
  const gameLogic = useGameLogic();
  const gameSettings = useGameSettings();
  const analytics = useAnalytics();

  return {
    gameLogic,
    gameSettings,
    analytics,
  };
}
