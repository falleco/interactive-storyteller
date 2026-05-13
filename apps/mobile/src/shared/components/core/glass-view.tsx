import {
  isLiquidGlassSupported,
  LiquidGlassView,
} from '@callstack/liquid-glass';
import BlurView from '@sbaiahmed1/react-native-blur';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Liquid-glass effect strength on iOS — `clear` is the most see-through,
   * `regular` reads more like a frosted panel. Ignored on Android.
   */
  effect?: 'clear' | 'regular' | 'none';
  /** Whether the iOS liquid glass should respond to touches with a sheen. */
  interactive?: boolean;
  /** Android elevation (shadow strength). Ignored on iOS. */
  elevation?: number;
  /**
   * Override the translucent tint on top of the blurred backdrop. On iOS
   * this colours the liquid glass; on Android it replaces the default
   * white-ish overlay so dark UIs can have a darker glass.
   */
  backgroundColor?: string;
}

/**
 * Cross-platform glass surface. On iOS 26+ it uses Apple's liquid glass via
 * `@callstack/liquid-glass`; on older iOS and on Android it falls back to a
 * real native blur (`@sbaiahmed1/react-native-blur`) plus a subtle tint so
 * the surface still reads as translucent.
 */
export function GlassView({
  children,
  style,
  effect = 'regular',
  interactive = false,
  elevation = 4,
  backgroundColor,
}: GlassViewProps) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={[
          styles.surface,
          backgroundColor ? { backgroundColor } : undefined,
          style,
        ]}
        interactive={interactive}
        effect={effect}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView
      blurType="light"
      // Heavy blur kills perf on Android; a small amount + tint reads as glass.
      blurAmount={4}
      style={[
        styles.surface,
        styles.androidFallback,
        elevation ? { elevation } : undefined,
        backgroundColor ? { backgroundColor } : undefined,
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
  },
  androidFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
});
