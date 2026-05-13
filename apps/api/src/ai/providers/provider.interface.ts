import type {
  AiCapability,
  ImageGenerationOptions,
  ImageGenerationResult,
  SpeechGenerationOptions,
  SpeechGenerationResult,
  TextGenerationOptions,
  TextGenerationResult,
  TextStreamChunk,
} from '../types';

/**
 * Provider contract — each AI provider implements only the capabilities it
 * supports. The `AiService` facade picks a provider per capability based on
 * the env-driven configuration.
 */
export interface AiProvider {
  readonly id: 'openai' | 'replicate';
  readonly capabilities: ReadonlyArray<AiCapability>;

  generateText?(options: TextGenerationOptions): Promise<TextGenerationResult>;

  streamText?(options: TextGenerationOptions): AsyncIterable<TextStreamChunk>;

  generateImage?(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult>;

  generateSpeech?(
    options: SpeechGenerationOptions,
  ): Promise<SpeechGenerationResult>;
}
