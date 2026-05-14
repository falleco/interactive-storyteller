import {
  type AudioPlayer,
  type AudioStatus,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseBookAudioResult {
  isPlaying: boolean;
  isLoading: boolean;
  hasSource: boolean;
  /** Current playback position in seconds (0 when not loaded). */
  currentTime: number;
  /** Total duration in seconds (0 when not loaded). */
  duration: number;
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

  // Synchronously track the source the caller asked for so we can gate
  // `currentTime`/`duration` until the player actually loads it. Without
  // this, the first render after a source change still returns the
  // *previous* source's status (the status hook hasn't caught up yet) —
  // narration-driven UI would flash a stale 100%-progress frame.
  const [trackedSource, setTrackedSource] = useState<string | null>(null);
  if (trackedSource !== (source ?? null)) {
    setTrackedSource(source ?? null);
  }

  // Set to the source whose status we've confirmed is loaded. Until
  // status reports `isLoaded` with a fresh `currentTime` for the current
  // tracked source we treat playback as not-yet-started.
  const [statusReadyFor, setStatusReadyFor] = useState<string | null>(null);
  const statusIsFresh =
    statusReadyFor === trackedSource && trackedSource !== null;

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
    // Suppress completion until the new audio actually starts playing.
    // The status effect (declared below) flushes in the same commit as
    // this one and still sees the *previous* source's "finished" status —
    // resetting the flag to false here would let it fire `onComplete`
    // immediately against the new source. We re-arm it from the status
    // effect once we see playback advance past 0.
    didCompleteRef.current = true;
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

  // Detect natural completion + mark the status as "fresh for the current
  // source" once it reflects a newly-loaded clip.
  useEffect(() => {
    if (!status) return;
    // Heuristic: a freshly-loaded source emits an `isLoaded` status with
    // a known duration and `currentTime` close to zero. Once we see that,
    // it's safe to trust subsequent times against the active source.
    if (
      status.isLoaded &&
      status.duration > 0 &&
      status.currentTime < 1 &&
      statusReadyFor !== trackedSource
    ) {
      setStatusReadyFor(trackedSource);
    }
    // Re-arm completion once the *new* source is actually playing — see
    // the source-change effect above for why we start out suppressed.
    if (
      status.isLoaded &&
      status.duration > 0 &&
      status.currentTime > 0 &&
      status.currentTime < status.duration - 0.1
    ) {
      didCompleteRef.current = false;
    }
    const didReachEnd = hasReachedEnd(status);
    if (didReachEnd && !didCompleteRef.current) {
      didCompleteRef.current = true;
      onComplete?.();
    }
  }, [status, onComplete, trackedSource, statusReadyFor]);

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
    isLoading: Boolean(source) && !statusIsFresh,
    hasSource: Boolean(source),
    // Only expose timings once we've confirmed the status reflects the
    // currently-tracked source — otherwise we'd briefly leak the previous
    // clip's finished `currentTime/duration` into the new slide.
    currentTime:
      statusIsFresh && status?.isLoaded ? (status.currentTime ?? 0) : 0,
    duration: statusIsFresh && status?.isLoaded ? (status.duration ?? 0) : 0,
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
