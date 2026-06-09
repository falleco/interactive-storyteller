import { describe, expect, it } from 'vitest';
import { hiddenObjectsDemoConfig } from './assets';
import {
  createHiddenObjectsState,
  findNextHiddenObjectPrompt,
  getHiddenObjectsProgress,
  markHiddenObjectFound,
} from './logic';

describe('hidden objects logic', () => {
  it('tracks valid found objects without counting duplicates', () => {
    const initial = createHiddenObjectsState();

    const withMoon = markHiddenObjectFound(
      hiddenObjectsDemoConfig,
      initial,
      'moon',
    );
    const duplicateMoon = markHiddenObjectFound(
      hiddenObjectsDemoConfig,
      withMoon,
      'moon',
    );
    const invalidItem = markHiddenObjectFound(
      hiddenObjectsDemoConfig,
      duplicateMoon,
      'cloud',
    );

    expect(invalidItem.foundIds).toEqual(['moon']);
    expect(
      getHiddenObjectsProgress(hiddenObjectsDemoConfig, invalidItem),
    ).toEqual({
      gameId: 'starlit-garden',
      completed: false,
      score: 1,
      total: 5,
    });
  });

  it('advances prompts and reports completion', () => {
    const complete = hiddenObjectsDemoConfig.targets.reduce(
      (state, target) =>
        markHiddenObjectFound(hiddenObjectsDemoConfig, state, target.id),
      createHiddenObjectsState(),
    );

    expect(findNextHiddenObjectPrompt(hiddenObjectsDemoConfig, complete)).toBe(
      'You found everything!',
    );
    expect(getHiddenObjectsProgress(hiddenObjectsDemoConfig, complete)).toEqual(
      {
        gameId: 'starlit-garden',
        completed: true,
        score: 5,
        total: 5,
      },
    );
  });
});
