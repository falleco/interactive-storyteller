import type { HiddenObjectGameConfig } from '@wondertales/shared';
import { HiddenObjectsGame, hiddenObjectsDemoConfig } from './hidden-objects';
import type { GameDefinition } from './types';

const hiddenObjectsCardImage = require('../../../assets/games/hidden-objects/card.png');

export const gameLibrary = [
  {
    id: 'hidden-objects',
    title: 'Hidden Objects',
    subtitle: 'Tap what the story asks you to find.',
    description:
      'A calm observation game for finding story objects in a playful scene.',
    ctaLabel: 'Start the hunt',
    ageRange: { min: 3, max: 8 },
    tags: ['Observation', 'Tap', 'Story scene'],
    thumbnailEmoji: '🔎',
    cardImage: hiddenObjectsCardImage,
    screen: {
      animation: 'slide_from_bottom',
    },
    descriptor: {
      id: 'hidden-objects-demo',
      type: 'hidden-objects',
      title: 'Starlit Garden Hunt',
      ageRange: { min: 3, max: 8 },
      prompt: 'Find the hidden objects in the garden.',
      config: hiddenObjectsDemoConfig,
    },
    Component: HiddenObjectsGame,
  } satisfies GameDefinition<HiddenObjectGameConfig>,
];

export function findGameDefinition(
  id: string,
): GameDefinition<any> | undefined {
  return gameLibrary.find((game) => game.id === id);
}
