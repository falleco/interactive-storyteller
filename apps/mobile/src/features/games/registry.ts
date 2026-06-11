import type { HiddenObjectGameConfig } from '@wondertales/shared';
import { HiddenObjectsGame, hiddenObjectsDemoConfig } from './hidden-objects';
import type { GameDefinition } from './types';

const demoCardImage = require('../../../assets/images/hud/dices_red_512.png');
const fitPuzzleCardImage = require('../../../assets/games/fit-puzzle/card.png');
const hiddenObjectsCardImage = require('../../../assets/games/hidden-objects/card.png');

const demoGame = {
  id: 'demo',
  title: 'Godot Demo',
  subtitle: 'Move, jump, and test the embedded Godot runtime.',
  description: 'A small Godot playground used to validate native game loading.',
  ctaLabel: 'Open demo',
  ageRange: { min: 3, max: 10 },
  tags: ['Godot', 'Controls'],
  thumbnailEmoji: '🎮',
  cardImage: demoCardImage,
  screen: {
    animation: 'slide_from_right',
  },
} satisfies GameDefinition;

const fitPuzzleGame = {
  id: 'fit-puzzle',
  title: 'Fit Puzzle',
  subtitle: 'Drag each object into the matching silhouette.',
  description: 'A tactile shape-matching puzzle powered by a full Godot scene.',
  ctaLabel: 'Play puzzle',
  ageRange: { min: 3, max: 8 },
  tags: ['Puzzle', 'Drag', 'Shapes'],
  thumbnailEmoji: '🧩',
  cardImage: fitPuzzleCardImage,
  screen: {
    animation: 'slide_from_right',
  },
} satisfies GameDefinition;

const hiddenObjectsGame = {
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
} satisfies GameDefinition<HiddenObjectGameConfig>;

export const gameLibrary = [demoGame, fitPuzzleGame];

const registeredGames = [...gameLibrary, hiddenObjectsGame];

export function findGameDefinition(
  id: string,
): GameDefinition<any> | undefined {
  return registeredGames.find((game) => game.id === id);
}
