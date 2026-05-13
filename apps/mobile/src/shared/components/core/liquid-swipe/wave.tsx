import MaskedView from '@react-native-masked-view/masked-view';
import type { ReactNode } from 'react';
import {
  type ColorValue,
  Dimensions,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { SharedVector } from './utils';

export const { width: WIDTH, height: HEIGHT } = Dimensions.get('screen');
/**
 * The minimum amount of the wave that's always visible while at rest —
 * acts as a "pull tab" hint on the side of the page.
 */
export const MIN_LEDGE = 25;
/**
 * Width of the edge hit zone. Touches starting outside this area do nothing.
 */
export const MARGIN_WIDTH = MIN_LEDGE + 50;

export enum WaveSide {
  LEFT = 0,
  RIGHT = 1,
  NONE = 2,
}

interface WaveProps {
  side: WaveSide;
  position: SharedVector;
  children: ReactNode;
  isTransitioning: SharedValue<boolean>;
  /**
   * Solid fallback colour painted underneath the masked content. Used as the
   * paint colour of the SVG path on Android (where we don't mask via
   * `MaskedView`) and ignored visually on iOS. Pick something close to the
   * adjacent slide's background so the seam doesn't flash.
   */
  androidFallbackFill?: ColorValue;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function vec2(x: number, y: number) {
  'worklet';
  return { x, y };
}

function curve(
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  to: { x: number; y: number },
) {
  'worklet';
  return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
}

/**
 * SVG wave mask that bulges where the finger pulls. The path is composed
 * of four cubic-bezier segments whose control points slide in lockstep
 * with the touch — the math is straight from the Candillon tutorial,
 * trusted as-is. Rotated 180° on the right side so one implementation
 * serves both edges.
 */
export function Wave({
  side,
  position: { x, y },
  children,
  isTransitioning,
  androidFallbackFill = 'black',
}: WaveProps) {
  // Radius of the wave's bulge — capped at half the screen width so we
  // never blow up into a full circle.
  const R = useDerivedValue(() => Math.min(x.value - MIN_LEDGE, WIDTH / 2));

  // Visible ledge on the page edge. Once the user is committing (snapping
  // past the threshold) we animate it all the way across so the wave
  // sweeps off-screen.
  const ledge = useDerivedValue(() => {
    const minLedge = interpolate(
      x.value,
      [0, MIN_LEDGE],
      [0, MIN_LEDGE],
      Extrapolation.CLAMP,
    );
    const baseLedge = minLedge + Math.max(0, x.value - MIN_LEDGE - R.value);
    return withSpring(isTransitioning.value ? x.value : baseLedge);
  });

  const animatedProps = useAnimatedProps(() => {
    const stepY = x.value - MIN_LEDGE; // half-height of the bulge
    const stepX = R.value / 2;
    // Cubic-bezier offset for approximating a circle, from spencermortensen.com.
    const C = stepY * 0.5522847498;

    const p1 = { x: ledge.value, y: y.value - 2 * stepY };
    const p2 = vec2(p1.x + stepX, p1.y + stepY);
    const p3 = vec2(p2.x + stepX, p2.y + stepY);
    const p4 = vec2(p3.x - stepX, p3.y + stepY);
    const p5 = vec2(p4.x - stepX, p4.y + stepY);

    const c11 = vec2(p1.x, p1.y + C);
    const c12 = vec2(p2.x, p2.y);
    const c21 = vec2(p2.x, p2.y);
    const c22 = vec2(p3.x, p3.y - C);
    const c31 = vec2(p3.x, p3.y + C);
    const c32 = vec2(p4.x, p4.y);
    const c41 = vec2(p4.x, p4.y);
    const c42 = vec2(p5.x, p5.y - C);

    return {
      d: [
        'M 0 0',
        `H ${p1.x}`,
        `V ${p1.y}`,
        curve(c11, c12, p2),
        curve(c21, c22, p3),
        curve(c31, c32, p4),
        curve(c41, c42, p5),
        `V ${HEIGHT}`,
        'H 0',
      ].join(' '),
    };
  });

  const maskElement = (
    <Svg
      style={[
        StyleSheet.absoluteFill,
        // Right side is just the left wave flipped horizontally — saves a
        // duplicate path implementation.
        {
          transform: [{ rotateY: side === WaveSide.RIGHT ? '180deg' : '0deg' }],
        },
      ]}
    >
      <AnimatedPath
        fill={Platform.OS === 'android' ? androidFallbackFill : 'black'}
        animatedProps={animatedProps}
      />
    </Svg>
  );

  // MaskedView is a no-go on Android (slow + flickery on the new arch)
  // so we approximate the effect there by translating the content sideways
  // by the same ledge offset, which keeps the seam aligned with the wave.
  const androidStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: isTransitioning.value
          ? withTiming(0)
          : side === WaveSide.RIGHT
            ? WIDTH - ledge.value
            : -WIDTH + ledge.value,
      },
    ],
  }));

  if (Platform.OS === 'android') {
    return (
      <View style={StyleSheet.absoluteFill}>
        {maskElement}
        <Animated.View style={[StyleSheet.absoluteFill, androidStyle]}>
          {children}
        </Animated.View>
      </View>
    );
  }

  return (
    <MaskedView style={StyleSheet.absoluteFill} maskElement={maskElement}>
      {children}
    </MaskedView>
  );
}
