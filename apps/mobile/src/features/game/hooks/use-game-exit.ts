import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { UseGameLogicReturn } from './use-game-logic';
import type { UseGameSettingsReturn } from './use-game-settings';

interface UseGameExitPromptOptions {
  onExit?: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Shared confirmation dialog for ending an active game session.
 */
export function useGameExitPrompt(
  gameLogic: UseGameLogicReturn,
  gameSettings: UseGameSettingsReturn,
  {
    onExit,
    title = 'End Game',
    message = 'Are you sure you want to end the current game?',
    confirmLabel = 'End Game',
    cancelLabel = 'Cancel',
  }: UseGameExitPromptOptions = {},
) {
  return useCallback(() => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: async () => {
          await gameLogic.endGame(gameSettings.gameSettings);
          onExit?.();
        },
      },
    ]);
  }, [
    cancelLabel,
    confirmLabel,
    gameLogic,
    gameSettings.gameSettings,
    message,
    onExit,
    title,
  ]);
}
