export type NarrationBlockKind = 'narration' | 'dialogue' | 'aside';

export interface NarrationWordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

export interface NarrationPhraseTiming {
  text: string;
  startTime: number;
  endTime: number;
  wordStartIndex: number;
  wordEndIndex: number;
}

export interface NarrationAudioTiming {
  provider: 'inworld';
  model: string;
  voice: string;
  language: string;
  words: NarrationWordTiming[];
  phrases: NarrationPhraseTiming[];
  duration: number | null;
}

export interface NarrationBlock {
  id: string;
  kind: NarrationBlockKind;
  text: string;
  /**
   * Voice identifier for this block. When null/undefined, clients and
   * generators use the book-level default voice.
   */
  voice?: string | null;
  speaker?: string | null;
  audioUrl?: string | null;
  audioObjectKey?: string | null;
  audioTiming?: NarrationAudioTiming | null;
}
