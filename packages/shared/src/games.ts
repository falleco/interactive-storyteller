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

export type StoryGameDescriptor<TConfig = Record<string, unknown>> = {
  id: string;
  type: string;
  title: string;
  ageRange: GameAgeRange;
  prompt: string;
  config: TConfig;
};

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
