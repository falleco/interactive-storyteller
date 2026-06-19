import MaskedView from '@react-native-masked-view/masked-view';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useDerivedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import type { SharedVector } from './utils';

export const { width: WIDTH, height: HEIGHT } = Dimensions.get('screen');
/**
 * The minimum amount of the wave that's always visible while at rest —
 * acts as a "pull tab" hint on the side of the page.
 */
export const MIN_LEDGE = 10;
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
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const WAVE_BORDER_COLOR = '#ffffff';
const WAVE_BORDER_WIDTH = 3;

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
}: WaveProps) {
  // Radius of the wave's bulge — capped at half the screen width so we
  // never blow up into a full circle.
  const R = useDerivedValue(() =>
    Math.max(0, Math.min(x.value - MIN_LEDGE, WIDTH / 2)),
  );

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
    return isTransitioning.value ? x.value : baseLedge;
  });

  const animatedProps = useAnimatedProps(() => {
    const stepY = Math.max(x.value - MIN_LEDGE, 0); // half-height of the bulge
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

  const animatedBorderProps = useAnimatedProps(() => {
    const stepY = Math.max(x.value - MIN_LEDGE, 0);
    const stepX = R.value / 2;
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
        `M ${p1.x} 0`,
        `V ${p1.y}`,
        curve(c11, c12, p2),
        curve(c21, c22, p3),
        curve(c31, c32, p4),
        curve(c41, c42, p5),
        `V ${HEIGHT}`,
      ].join(' '),
    };
  });

  // Pure-black fill is what `MaskedView` interprets as "visible" — the
  // black-shaped area lets the wrapped content show through, everything
  // outside is hidden. Same semantics on iOS and Android with
  // `@react-native-masked-view/masked-view` 0.3.x.
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
      <AnimatedPath fill="black" animatedProps={animatedProps} />
    </Svg>
  );

  return (
    <>
      <MaskedView style={StyleSheet.absoluteFill} maskElement={maskElement}>
        {children}
      </MaskedView>
      <Svg
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { rotateY: side === WaveSide.RIGHT ? '180deg' : '0deg' },
            ],
          },
        ]}
      >
        <AnimatedPath
          animatedProps={animatedBorderProps}
          fill="none"
          stroke={WAVE_BORDER_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={WAVE_BORDER_WIDTH}
        />
      </Svg>
    </>
  );
}
