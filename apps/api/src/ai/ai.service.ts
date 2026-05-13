import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigurationType } from '../config/configuration';
import { OpenAiProvider } from './providers/openai.provider';
import type { AiProvider } from './providers/provider.interface';
import { ReplicateProvider } from './providers/replicate.provider';
import type {
  AiCapability,
  ImageGenerationOptions,
  ImageGenerationResult,
  SpeechGenerationOptions,
  SpeechGenerationResult,
  TextGenerationOptions,
  TextGenerationResult,
  TextStreamChunk,
} from './types';

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService<AppConfigurationType, true>,
    private readonly openai: OpenAiProvider,
    private readonly replicate: ReplicateProvider,
  ) {}

  async generateText(
    options: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    const provider = this.providerFor('text');
    if (!provider.generateText) {
      throw new Error(
        `Provider "${provider.id}" does not implement text generation`,
      );
    }
    return provider.generateText(options);
  }

  streamText(options: TextGenerationOptions): AsyncIterable<TextStreamChunk> {
    const provider = this.providerFor('text');
    if (!provider.streamText) {
      throw new Error(
        `Provider "${provider.id}" does not implement text streaming`,
      );
    }
    return provider.streamText(options);
  }

  async generateImage(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const provider = this.providerFor('image');
    if (!provider.generateImage) {
      throw new Error(
        `Provider "${provider.id}" does not implement image generation`,
      );
    }
    return provider.generateImage(options);
  }

  async generateSpeech(
    options: SpeechGenerationOptions,
  ): Promise<SpeechGenerationResult> {
    const provider = this.providerFor('speech');
    if (!provider.generateSpeech) {
      throw new Error(
        `Provider "${provider.id}" does not implement speech generation`,
      );
    }
    return provider.generateSpeech(options);
  }

  private providerFor(capability: AiCapability): AiProvider {
    const id = this.config.getOrThrow('ai', { infer: true }).providers[
      capability
    ];
    const provider = id === 'openai' ? this.openai : this.replicate;
    if (!provider.capabilities.includes(capability)) {
      throw new Error(
        `Provider "${provider.id}" cannot serve capability "${capability}"`,
      );
    }
    return provider;
  }
}
