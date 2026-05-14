import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PullButton } from './pull-button';
import { snapPoint, useVector } from './utils';
import { HEIGHT, MARGIN_WIDTH, Wave, WaveSide, WIDTH } from './wave';

const PREV = WIDTH;
const NEXT = 0;
const LEFT_SNAP_POINTS = [MARGIN_WIDTH, PREV];
const RIGHT_SNAP_POINTS = [NEXT, WIDTH - MARGIN_WIDTH];
/**
 * How far the wave bulges outward during the idle-hint yo-yo. Small
 * enough that it reads as a "wiggle" rather than an unintended commit.
 */
const HINT_AMPLITUDE = 24;
/**
 * Slide-content nudge as a fraction of the wave bulge. Less than 1 so
 * the slide moves more subtly than the handle itself.
 */
const HINT_SLIDE_RATIO = 0.45;
/**
 * Peak translation the chevron drifts toward while it "holds back" as
 * the wave pulls outward. Small enough to read as the rubber-band
 * being stretched — not big enough to compete with the button itself.
 */
const HINT_ICON_LEAD = 3;

interface SliderProps {
  index: number;
  setIndex: (next: number) => void;
  children: ReactNode;
  /** Slide rendered behind the left wave when the user drags right. */
  prev?: ReactNode;
  /** Slide rendered behind the right wave when the user drags left. */
  next?: ReactNode;
  /**
   * Idle time (ms) before the next-side handle starts pulsing purple
   * and the slide nudges over to hint the user toward the swipe.
   * Resets whenever the user touches; re-arms after a non-committing
   * release.
   */
  hintAfterMs?: number;
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
  hintAfterMs = 3000,
}: SliderProps) {
  const hasPrev = !!prev;
  const hasNext = !!next;
  const zIndex = useSharedValue(0);
  const left = useVector(0, HEIGHT / 2);
  const right = useVector(0, HEIGHT / 2);
  const activeSide = useSharedValue<WaveSide>(WaveSide.NONE);
  const isTransitioningLeft = useSharedValue(false);
  const isTransitioningRight = useSharedValue(false);
  /** 1 while the idle hint yo-yo is running, 0 otherwise. */
  const hintActive = useSharedValue(0);
  /**
   * Translation (signed magnitude) of the chevron icon during the hint
   * pulse. Driven on its own animation so the icon can keep bouncing
   * after the wave finishes its trip outward — that gives the "spring"
   * feel rather than the icon being glued to the wave's position.
   */
  const iconOffset = useSharedValue(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHint = useCallback(() => {
    'worklet';
    hintActive.value = 1;
    // Cancel any in-flight spring before starting the repeat, otherwise
    // the new animation starts from a transient value and the yo-yo
    // doesn't ride MARGIN_WIDTH cleanly.
    cancelAnimation(right.x);
    cancelAnimation(iconOffset);
    // Wave: timing-based so it actually *settles* at MARGIN_WIDTH between
    // pulses — springs were leaving residual oscillation that made the
    // handle look stuck forward.
    right.x.value = withRepeat(
      withSequence(
        withTiming(MARGIN_WIDTH + HINT_AMPLITUDE, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(MARGIN_WIDTH, {
          duration: 460,
          easing: Easing.inOut(Easing.cubic),
        }),
        withDelay(650, withTiming(MARGIN_WIDTH, { duration: 1 })),
      ),
      -1,
      false,
    );
    // Icon: rubber-band motion. As the wave starts pulling outward the
    // arrow briefly *holds back* (ease-in over 110ms builds tension),
    // then *releases* via elastic-out so it snaps through its rest
    // position and oscillates side-to-side around it before settling.
    // After the snap it rides along with the button at translateX=0 for
    // the remainder of the cycle. Total = 1490ms, phase-locked with the
    // wave so every wave pulse triggers a fresh rubber-band snap.
    iconOffset.value = withRepeat(
      withSequence(
        withTiming(HINT_ICON_LEAD + HINT_AMPLITUDE / 100, {
          duration: 10,
          easing: Easing.in(Easing.cubic),
        }),
        withTiming(0, {
          duration: 500,
          easing: Easing.out(Easing.elastic(3.2)),
        }),
        withDelay(800, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [right.x, iconOffset, hintActive]);

  const stopHint = useCallback(() => {
    'worklet';
    hintActive.value = 0;
    cancelAnimation(right.x);
    cancelAnimation(iconOffset);
    right.x.value = withSpring(MARGIN_WIDTH);
    iconOffset.value = withTiming(0, { duration: 200 });
  }, [right.x, iconOffset, hintActive]);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const scheduleHint = useCallback(() => {
    clearHintTimer();
    if (!hasNext || hintAfterMs <= 0) return;
    hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null;
      startHint();
    }, hintAfterMs);
  }, [hasNext, hintAfterMs, startHint, clearHintTimer]);

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

  // Schedule the hint once the next-side handle becomes available, and
  // tear it down on unmount. Touch-driven cancellation lives in the pan
  // gesture below.
  useEffect(() => {
    if (hasNext) {
      scheduleHint();
    } else {
      clearHintTimer();
      stopHint();
    }
    return () => {
      clearHintTimer();
    };
  }, [hasNext, scheduleHint, clearHintTimer, stopHint]);

  // 0..1 progress derived from where the wave sits inside the hint
  // amplitude band. Used to drive both the slide-content nudge and the
  // PullButton's purple tint so they move in lockstep with the wave.
  const hintProgress = useDerivedValue(() => {
    if (activeSide.value !== WaveSide.NONE) return 0;
    if (hintActive.value === 0) return 0;
    const t = (right.x.value - MARGIN_WIDTH) / HINT_AMPLITUDE;
    return Math.min(Math.max(t, 0), 1);
  });

  const slideHintStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -hintProgress.value * HINT_AMPLITUDE * HINT_SLIDE_RATIO },
    ],
  }));

  const pan = Gesture.Pan()
    // Only activate the wave-pull gesture on clear horizontal motion so
    // a vertical scroll inside the slide (e.g. long page content) flows
    // through to a nested ScrollView instead of being captured here.
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onBegin((event) => {
      // Any touch — even one outside the edge hit zones — interrupts the
      // attention-grabbing hint so it stops fighting the user's focus.
      if (hintActive.value === 1) {
        stopHint();
      }
      runOnJS(clearHintTimer)();
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
              runOnJS(scheduleHint)();
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
              // The user pulled but didn't commit — re-arm the hint
              // after the configured idle window so they get another
              // nudge if they walk away from the screen.
              runOnJS(scheduleHint)();
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
        {/* The current slide rides the hint nudge — it shifts slightly
            toward the swipe direction in lockstep with the pulsing wave
            so the motion reads as one continuous hint. */}
        <Animated.View style={[StyleSheet.absoluteFill, slideHintStyle]}>
          {current}
        </Animated.View>
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
              hintProgress={hintProgress}
              iconOffset={iconOffset}
            />
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
