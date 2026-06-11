import type {
  GameAgeRange,
  GameCompletionResult,
  StoryGameDescriptor,
} from '@wondertales/shared';
import type { ComponentType } from 'react';

export type GameScreenAnimation =
  | 'default'
  | 'fade'
  | 'flip'
  | 'slide_from_bottom'
  | 'slide_from_left'
  | 'slide_from_right';

export type GamePlayComponentProps<TConfig = Record<string, unknown>> = {
  descriptor: StoryGameDescriptor<TConfig>;
  onComplete?: (result: GameCompletionResult) => void;
};

export type GameDefinition<TConfig = Record<string, unknown>> = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  ctaLabel?: string;
  ageRange?: GameAgeRange;
  tags?: string[];
  thumbnailEmoji?: string;
  cardImage: number;
  screen?: {
    animation: GameScreenAnimation;
  };
  descriptor?: StoryGameDescriptor<TConfig>;
  Component?: ComponentType<GamePlayComponentProps<TConfig>>;
};
