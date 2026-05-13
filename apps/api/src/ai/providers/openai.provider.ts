import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { AppConfigurationType } from '../../config/configuration';
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
import type { AiProvider } from './provider.interface';

const DEFAULT_IMAGE_MODEL = 'dall-e-3';
const DEFAULT_SPEECH_MODEL = 'tts-1';
const DEFAULT_VOICE = 'nova';

type OpenAIImageSize = '1024x1024' | '1792x1024' | '1024x1792';
type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly id = 'openai' as const;
  readonly capabilities: ReadonlyArray<AiCapability> = [
    'text',
    'image',
    'speech',
  ];

  private client: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService<AppConfigurationType, true>,
  ) {}

  async generateText(
    options: TextGenerationOptions,
  ): Promise<TextGenerationResult> {
    const response = await this.getClient().chat.completions.create({
      model: options.model ?? this.defaultTextModel(),
      messages: options.messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message.content ?? '',
      finishReason: choice?.finish_reason ?? 'unknown',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *streamText(
    options: TextGenerationOptions,
  ): AsyncIterable<TextStreamChunk> {
    const stream = await this.getClient().chat.completions.create({
      model: options.model ?? this.defaultTextModel(),
      messages: options.messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const usage = chunk.usage
        ? {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          }
        : undefined;

      if (!choice && !usage) continue;

      const delta = choice?.delta?.content ?? '';
      if (delta || choice?.finish_reason || usage) {
        yield {
          delta,
          finishReason: choice?.finish_reason ?? undefined,
          usage,
        };
      }
    }
  }

  async generateImage(
    options: ImageGenerationOptions,
  ): Promise<ImageGenerationResult> {
    const response = await this.getClient().images.generate({
      model: options.model ?? DEFAULT_IMAGE_MODEL,
      prompt: options.prompt,
      size: pickImageSize(options.aspectRatio),
      n: options.n ?? 1,
    });

    return {
      images: (response.data ?? []).map((img) => ({
        url: img.url ?? undefined,
        base64: img.b64_json ?? undefined,
      })),
    };
  }

  async generateSpeech(
    options: SpeechGenerationOptions,
  ): Promise<SpeechGenerationResult> {
    const response = await this.getClient().audio.speech.create({
      model: options.model ?? DEFAULT_SPEECH_MODEL,
      voice: ((options.voice as OpenAIVoice | undefined) ??
        DEFAULT_VOICE) as OpenAIVoice,
      input: options.text,
    });

    return {
      audio: await response.arrayBuffer(),
      contentType: 'audio/mpeg',
    };
  }

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.config.getOrThrow('ai', { infer: true }).openai
        .apiKey;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  private defaultTextModel(): string {
    return this.config.getOrThrow('ai', { infer: true }).models.text;
  }
}

function pickImageSize(aspectRatio: string | undefined): OpenAIImageSize {
  if (!aspectRatio) return '1024x1024';
  const [w, h] = aspectRatio.split(':').map((v) => Number.parseInt(v, 10));
  if (!w || !h) return '1024x1024';
  if (w > h) return '1792x1024';
  if (h > w) return '1024x1792';
  return '1024x1024';
}
