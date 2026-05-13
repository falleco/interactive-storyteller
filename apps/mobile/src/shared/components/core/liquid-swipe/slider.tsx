import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { PullButton } from './pull-button';
import { snapPoint, useVector } from './utils';
import { HEIGHT, MARGIN_WIDTH, Wave, WaveSide, WIDTH } from './wave';

const PREV = WIDTH;
const NEXT = 0;
const LEFT_SNAP_POINTS = [MARGIN_WIDTH, PREV];
const RIGHT_SNAP_POINTS = [NEXT, WIDTH - MARGIN_WIDTH];

interface SliderProps {
  index: number;
  setIndex: (next: number) => void;
  children: ReactNode;
  /** Slide rendered behind the left wave when the user drags right. */
  prev?: ReactNode;
  /** Slide rendered behind the right wave when the user drags left. */
  next?: ReactNode;
}

/**
 * Liquid swipe slider — Candillon's tutorial port. The current slide sits
 * flat in the middle; pulling from a screen edge unmasks the adjacent
 * slide through a curved bezier wave that follows the finger. Release past
 * the threshold commits the swipe and the parent advances the index.
 *
 * Mount with `key={index}` so each transition starts from a fresh state.
 */
export function Slider({
  index,
  setIndex,
  children: current,
  prev,
  next,
}: SliderProps) {
  const hasPrev = !!prev;
  const hasNext = !!next;
  const zIndex = useSharedValue(0);
  const left = useVector(0, HEIGHT / 2);
  const right = useVector(0, HEIGHT / 2);
  const activeSide = useSharedValue<WaveSide>(WaveSide.NONE);
  const isTransitioningLeft = useSharedValue(false);
  const isTransitioningRight = useSharedValue(false);

  // Settle to the resting ledge whenever:
  //  - the index changes (after a commit), OR
  //  - a neighbour gains/loses content (e.g. audio finishes and the parent
  //    arms `next`).
  // The spring runs even when the corresponding wave isn't mounted yet —
  // by the time the Wave appears, x.value is already at MARGIN_WIDTH so
  // the ledge animates in cleanly instead of staying offscreen.
  useEffect(() => {
    left.x.value = hasPrev ? withSpring(MARGIN_WIDTH) : 0;
    right.x.value = hasNext ? withSpring(MARGIN_WIDTH) : 0;
  }, [index, hasPrev, hasNext, left, right]);

  const pan = Gesture.Pan()
    .onBegin((event) => {
      if (event.x <= MARGIN_WIDTH && hasPrev) {
        activeSide.value = WaveSide.LEFT;
        // Stack the left wave above the right one so they don't fight when
        // the gesture starts near a corner.
        zIndex.value = 100;
      } else if (event.x >= WIDTH - MARGIN_WIDTH && hasNext) {
        activeSide.value = WaveSide.RIGHT;
      } else {
        activeSide.value = WaveSide.NONE;
      }
    })
    .onChange((event) => {
      if (activeSide.value === WaveSide.LEFT) {
        left.x.value = Math.max(event.x, MARGIN_WIDTH);
        left.y.value = event.y;
      } else if (activeSide.value === WaveSide.RIGHT) {
        right.x.value = Math.max(WIDTH - event.x, MARGIN_WIDTH);
        right.y.value = event.y;
      }
    })
    .onEnd((event) => {
      if (activeSide.value === WaveSide.LEFT) {
        const dest = snapPoint(event.x, event.velocityX, LEFT_SNAP_POINTS);
        // `PREV` snap means "commit" — flip the flag so the wave knows to
        // sweep all the way across instead of resting at the ledge. The
        // reference used `restSpeedThreshold`/`restDisplacementThreshold`
        // to settle the spring early on commit, but reanimated v4 dropped
        // those keys — `overshootClamping: true` already makes the spring
        // stop the moment it crosses the target, which is what we need.
        isTransitioningLeft.value = dest === PREV;
        left.x.value = withSpring(
          dest,
          {
            velocity: event.velocityX,
            overshootClamping: isTransitioningLeft.value,
          },
          () => {
            if (isTransitioningLeft.value) {
              runOnJS(setIndex)(index - 1);
            } else {
              zIndex.value = 0;
              activeSide.value = WaveSide.NONE;
            }
          },
        );
        left.y.value = withSpring(HEIGHT / 2, { velocity: event.velocityY });
      } else if (activeSide.value === WaveSide.RIGHT) {
        const dest = snapPoint(event.x, event.velocityX, RIGHT_SNAP_POINTS);
        isTransitioningRight.value = dest === NEXT;
        right.x.value = withSpring(
          WIDTH - dest,
          {
            velocity: event.velocityX,
            overshootClamping: isTransitioningRight.value,
          },
          () => {
            if (isTransitioningRight.value) {
              runOnJS(setIndex)(index + 1);
            } else {
              activeSide.value = WaveSide.NONE;
            }
          },
        );
        right.y.value = withSpring(HEIGHT / 2, { velocity: event.velocityY });
      }
    });

  const leftLayerStyle = useAnimatedStyle(() => ({
    zIndex: zIndex.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={StyleSheet.absoluteFill}>
        {current}
        {prev && (
          <Animated.View style={[StyleSheet.absoluteFill, leftLayerStyle]}>
            <Wave
              position={left}
              side={WaveSide.LEFT}
              isTransitioning={isTransitioningLeft}
            >
              {prev}
            </Wave>
            <PullButton
              position={left}
              side={WaveSide.LEFT}
              activeSide={activeSide}
            />
          </Animated.View>
        )}
        {next && (
          <Animated.View style={StyleSheet.absoluteFill}>
            <Wave
              position={right}
              side={WaveSide.RIGHT}
              isTransitioning={isTransitioningRight}
            >
              {next}
            </Wave>
            <PullButton
              position={right}
              side={WaveSide.RIGHT}
              activeSide={activeSide}
            />
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
