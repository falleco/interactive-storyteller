import { AVAILABLE_GAMES } from '@wondertales/shared/games';

export const availableGameDescriptors = AVAILABLE_GAMES;

export const availableGames = availableGameDescriptors.map((game) => game.id);

export const storyAvailableGames = availableGameDescriptors.filter(
  (game) => game.storyEnabled,
);
