import { useEffect, useMemo } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ThemedText,
  type ThemedTextProps,
} from '~/shared/components/themed-text';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';

interface NarratedTextProps extends Omit<ThemedTextProps, 'children'> {
  text: string;
  /**
   * 0..1 narration progress. Words near this cursor smoothly brighten
   * from `dimOpacity` to 1 so the kid can see where the narration is.
   */
  progress: number;
  dimOpacity?: number;
  /**
   * Width (in characters) of the fade zone leading up to a word's start.
   * Wider zones make the transition feel smoother but also "leak"
   * brightness onto upcoming words sooner. ~12 chars ≈ ~2 short words.
   */
  fadeChars?: number;
}

const DEFAULT_DIM = 0.32;
const DEFAULT_FADE_CHARS = 14;
/**
 * Expo-audio pushes status updates every ~200-300ms. Tweening the
 * progress shared value over slightly longer than that keeps the
 * highlight gliding smoothly between updates instead of stepping.
 */
const TWEEN_DURATION_MS = 320;

interface Token {
  value: string;
  start: number;
  end: number;
}

function tokenize(text: string): Token[] {
  if (!text) return [];
  // Split on whitespace but preserve the whitespace tokens so spacing
  // and newlines render exactly as authored.
  const parts = text.split(/(\s+)/);
  const tokens: Token[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part.length === 0) continue;
    const start = cursor;
    cursor += part.length;
    tokens.push({ value: part, start, end: cursor });
  }
  return tokens;
}

/**
 * Karaoke-style narration highlight. Default text is dim; as the audio
 * progresses each word brightens smoothly when the playhead approaches.
 *
 * Each word animates **colour** (not opacity) because Android's inline
 * `<Text>` doesn't honour per-span `opacity` reliably — RN merges nested
 * inline texts into a single text run and Reanimated's animated style
 * gets discarded. Animating the `color` channel works on both platforms
 * since inline text always picks up its own colour even when nested.
 */
export function NarratedText({
  text,
  progress,
  dimOpacity = DEFAULT_DIM,
  fadeChars = DEFAULT_FADE_CHARS,
  ...themedTextProps
}: NarratedTextProps) {
  const scheme = useColorScheme();
  const tokens = useMemo(() => tokenize(text), [text]);
  const totalChars = useMemo(() => Math.max(text.length, 1), [text.length]);

  const baseColor = scheme === 'dark' ? '#ffffff' : '#000000';
  const dimColor =
    scheme === 'dark'
      ? `rgba(255, 255, 255, ${dimOpacity})`
      : `rgba(0, 0, 0, ${dimOpacity})`;

  const cursorChars = useSharedValue(progress * totalChars);

  useEffect(() => {
    cursorChars.value = withTiming(progress * totalChars, {
      duration: TWEEN_DURATION_MS,
      easing: Easing.linear,
    });
  }, [progress, totalChars, cursorChars]);

  return (
    <ThemedText {...themedTextProps}>
      {tokens.map((tok, i) => (
        <NarratedWord
          // biome-ignore lint/suspicious/noArrayIndexKey: token order is stable per slide
          key={`tok-${i}`}
          token={tok}
          cursor={cursorChars}
          baseColor={baseColor}
          dimColor={dimColor}
          fadeChars={fadeChars}
        />
      ))}
    </ThemedText>
  );
}

interface NarratedWordProps {
  token: Token;
  cursor: ReturnType<typeof useSharedValue<number>>;
  baseColor: string;
  dimColor: string;
  fadeChars: number;
}

function NarratedWord({
  token,
  cursor,
  baseColor,
  dimColor,
  fadeChars,
}: NarratedWordProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const c = cursor.value;
    let t: number;
    if (c >= token.end) {
      t = 1;
    } else {
      const fadeStart = token.start - fadeChars;
      if (c <= fadeStart) {
        t = 0;
      } else {
        const span = token.end - fadeStart;
        t = Math.min(Math.max((c - fadeStart) / span, 0), 1);
      }
    }
    return {
      color: interpolateColor(t, [0, 1], [dimColor, baseColor]),
    };
  }, [baseColor, dimColor, fadeChars, token.end, token.start]);

  return <Animated.Text style={animatedStyle}>{token.value}</Animated.Text>;
}
