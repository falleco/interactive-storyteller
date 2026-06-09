import type {
  GameCompletionResult,
  HiddenObjectGameConfig,
} from '@wondertales/shared';

export type HiddenObjectsState = {
  foundIds: string[];
};

export function createHiddenObjectsState(): HiddenObjectsState {
  return { foundIds: [] };
}

export function isHiddenObjectFound(
  state: HiddenObjectsState,
  itemId: string,
): boolean {
  return state.foundIds.includes(itemId);
}

export function findNextHiddenObjectPrompt(
  config: HiddenObjectGameConfig,
  state: HiddenObjectsState,
): string {
  return (
    config.targets.find((target) => !state.foundIds.includes(target.id))
      ?.prompt ?? 'You found everything!'
  );
}

export function markHiddenObjectFound(
  config: HiddenObjectGameConfig,
  state: HiddenObjectsState,
  itemId: string,
): HiddenObjectsState {
  if (!config.targets.some((target) => target.id === itemId)) return state;
  if (state.foundIds.includes(itemId)) return state;

  return {
    foundIds: [...state.foundIds, itemId],
  };
}

export function getHiddenObjectsProgress(
  config: HiddenObjectGameConfig,
  state: HiddenObjectsState,
): GameCompletionResult {
  return {
    gameId: config.sceneId,
    completed: state.foundIds.length === config.targets.length,
    score: state.foundIds.length,
    total: config.targets.length,
  };
}
