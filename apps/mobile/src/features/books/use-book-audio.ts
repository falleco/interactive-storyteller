import {
  type AudioPlayer,
  type AudioStatus,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

export interface UseBookAudioResult {
  isPlaying: boolean;
  isLoading: boolean;
  hasSource: boolean;
  toggle: () => void;
  /** Reset playback head to zero and pause. */
  reset: () => void;
}

interface UseBookAudioOptions {
  /** Audio URL for the currently active page (null while loading). */
  source: string | null;
  /** Auto-play when source becomes available. */
  autoPlay?: boolean;
  /** Called when the current audio finishes naturally. */
  onComplete?: () => void;
}

/**
 * Single AudioPlayer instance backing the BookPlayer. The hook swaps source
 * when the active page changes — much cheaper than recreating a player per
 * page.
 */
export function useBookAudio(options: UseBookAudioOptions): UseBookAudioResult {
  const player = useAudioPlayer(null) as AudioPlayer;
  const status = useAudioPlayerStatus(player);
  const previousSourceRef = useRef<string | null>(null);
  const didCompleteRef = useRef(false);
  const { source, autoPlay = true, onComplete } = options;

  // Swap source on change. expo-audio supports both string and { uri } forms.
  useEffect(() => {
    if (!source) {
      if (previousSourceRef.current !== null) {
        previousSourceRef.current = null;
        try {
          player.pause();
        } catch {
          // player may not yet be ready; ignore
        }
      }
      return;
    }

    if (previousSourceRef.current === source) return;

    previousSourceRef.current = source;
    didCompleteRef.current = false;
    try {
      player.replace({ uri: source });
      if (autoPlay) {
        player.play();
      }
    } catch {
      // ignore; user can press play again
    }
  }, [player, source, autoPlay]);

  // Pause/cleanup when unmounting.
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  // Detect natural completion.
  useEffect(() => {
    if (!status) return;
    const didReachEnd = hasReachedEnd(status);
    if (didReachEnd && !didCompleteRef.current) {
      didCompleteRef.current = true;
      onComplete?.();
    }
  }, [status, onComplete]);

  const toggle = useCallback(() => {
    if (status?.playing) {
      player.pause();
    } else {
      // If audio finished, start over.
      if (status && hasReachedEnd(status)) {
        player.seekTo(0).catch(() => undefined);
        didCompleteRef.current = false;
      }
      player.play();
    }
  }, [player, status]);

  const reset = useCallback(() => {
    try {
      player.pause();
      player.seekTo(0).catch(() => undefined);
      didCompleteRef.current = false;
    } catch {
      // ignore
    }
  }, [player]);

  return {
    isPlaying: Boolean(status?.playing),
    isLoading: Boolean(source) && !status?.isLoaded,
    hasSource: Boolean(source),
    toggle,
    reset,
  };
}

function hasReachedEnd(status: AudioStatus): boolean {
  if (!status.isLoaded) return false;
  if (status.duration <= 0) return false;
  // expo-audio reports `didJustFinish` true on natural end, but during
  // looping or seeking it can flap — comparing currentTime to duration is
  // the most reliable signal across platforms.
  return status.currentTime >= status.duration - 0.1;
}
