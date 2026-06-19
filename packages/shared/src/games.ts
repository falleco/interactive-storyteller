import type { NarrationAudioTiming } from './stories';

export type GameAgeRange = {
  min: number;
  max: number;
};

export type GameCompletionResult = {
  gameId: string;
  completed: boolean;
  score: number;
  total: number;
};

export type AvailableStoryGame = {
  id: string;
  type: string;
  title: string;
  description: string;
  ageRange: GameAgeRange;
  storyEnabled: boolean;
  storyPrompt: string;
  config: Record<string, unknown>;
};

export const STORY_GAME_NARRATION_CUES = [
  {
    id: 'start',
    label: 'Start',
  },
  {
    id: 'failure',
    label: 'Failure move',
  },
  {
    id: 'successMove',
    label: 'Success move',
  },
  {
    id: 'idle',
    label: 'Idle call to action',
  },
  {
    id: 'complete',
    label: 'Complete',
  },
] as const;

export type StoryGameNarrationCueId =
  (typeof STORY_GAME_NARRATION_CUES)[number]['id'];

export type StoryGameNarrationCue = {
  text: string;
  voice?: string | null;
  audioUrl?: string | null;
  audioObjectKey?: string | null;
  audioTiming?: NarrationAudioTiming | null;
};

export type StoryGameNarration = Partial<
  Record<StoryGameNarrationCueId, StoryGameNarrationCue>
>;

export type StoryGameNarrationByLanguage = Record<string, StoryGameNarration>;

export type StoryGameDescriptor<TConfig = Record<string, unknown>> = {
  id: string;
  type: string;
  title: string;
  ageRange: GameAgeRange;
  prompt: string;
  config: TConfig;
  narration?: StoryGameNarrationByLanguage;
};

export const AVAILABLE_GAMES = [
  {
    id: 'demo',
    type: 'godot-demo',
    title: 'Godot Demo',
    description:
      'Internal Godot playground used only to validate native runtime loading and controls.',
    ageRange: { min: 3, max: 10 },
    storyEnabled: false,
    storyPrompt:
      'Never use this game in generated stories. It exists only for development tests.',
    config: {},
  },
  {
    id: 'fit-puzzle',
    type: 'godot-fit-puzzle',
    title: 'Fit Puzzle',
    description:
      'A tactile shape-matching puzzle where the child drags each object into its matching silhouette.',
    ageRange: { min: 3, max: 8 },
    storyEnabled: true,
    storyPrompt:
      'Use when the story needs the child to repair, unlock, arrange, complete, or rebuild something by matching shapes. After completion, the next story page should clearly acknowledge that the child solved the puzzle and that the characters can continue because of it.',
    config: { roundId: 'mobile-fit-puzzle' },
  },
  {
    id: 'word-puzzle',
    type: 'godot-word-puzzle',
    title: 'Word Puzzle',
    description:
      'A writing puzzle where the child drags letter blocks into the right order to spell a target word.',
    ageRange: { min: 4, max: 10 },
    storyEnabled: true,
    storyPrompt:
      'Use when the story needs the child to learn, reveal, remember, or spell a short important word. The minigame asks the child to assemble the target word with draggable letters, and the next page should acknowledge that spelling the word unlocked progress.',
    config: {
      extraLetterCount: 4,
      roundId: 'mobile-word-puzzle',
      targetWord: 'STAR',
    },
  },
  {
    id: 'nail-paint',
    type: 'godot-nail-paint',
    title: 'Nail Paint',
    description:
      'A creative nail painting game where the child decorates a fingernail with colors and playful patterns.',
    ageRange: { min: 3, max: 10 },
    storyEnabled: true,
    storyPrompt:
      'Use when the story needs the child to decorate, restore color, prepare for a celebration, add a magical pattern, or make a character feel proud and ready. The minigame lets the child paint a fingernail with colors and patterns, and the next page should acknowledge the finished decoration.',
    config: {
      colorHexes: ['#FF5A8A', '#7C4DFF', '#29B6F6', '#FDE047'],
      patternIds: ['plain', 'dots', 'stars', 'hearts', 'stripes'],
      roundId: 'mobile-nail-paint',
    },
  },
] as const satisfies readonly AvailableStoryGame[];

export function getStoryEnabledGames(): AvailableStoryGame[] {
  return AVAILABLE_GAMES.filter((game) => game.storyEnabled);
}

export function findAvailableGame(id: string): AvailableStoryGame | undefined {
  return AVAILABLE_GAMES.find((game) => game.id === id);
}

export function toStoryGameDescriptor(
  game: AvailableStoryGame,
  prompt?: string,
): StoryGameDescriptor {
  return {
    id: game.id,
    type: game.type,
    title: game.title,
    ageRange: game.ageRange,
    prompt: prompt?.trim() || game.storyPrompt,
    config: game.config,
  };
}

export type HiddenObjectTarget = {
  id: string;
  label: string;
  prompt: string;
};

export type HiddenObjectSceneItem = HiddenObjectTarget & {
  x: number;
  y: number;
  visualSize: number;
  hitSize: number;
  tint: string;
};

export type HiddenObjectGameConfig = {
  sceneId: string;
  sceneTitle: string;
  targets: HiddenObjectTarget[];
  items: HiddenObjectSceneItem[];
};
