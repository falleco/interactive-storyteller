export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface TextGenerationOptions {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface TextUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TextGenerationResult {
  content: string;
  finishReason: string;
  usage?: TextUsage;
}

export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  /** Aspect-ratio hint (e.g. "1:1", "16:9"). Provider-dependent. */
  aspectRatio?: string;
  n?: number;
  /** URL of a reference image (model-dependent — most providers ignore it). */
  referenceImageUrl?: string;
}

export interface ImageGenerationResult {
  images: Array<{
    url?: string;
    base64?: string;
  }>;
}

/** ISO language code (matches our `Storyteller.language` values). */
export type Language = 'en' | 'fr' | 'pt' | 'it';

export interface SpeechGenerationOptions {
  text: string;
  model?: string;
  voice?: string;
  language?: Language;
}

export interface SpeechGenerationResult {
  audio: ArrayBuffer;
  contentType: string;
}

export interface TextStreamChunk {
  delta: string;
  finishReason?: string;
  usage?: TextUsage;
}

export type AiCapability = 'text' | 'image' | 'speech';
