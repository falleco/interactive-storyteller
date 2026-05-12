import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const useAnimatedSlideTo = ({
  start,
  end,
  duration = 800,
}: {
  start: number;
  end: number;
  duration?: number;
}) => {
  const value = useSharedValue(start);

  const slideTo = useCallback(() => {
    value.value = start;

    // Animate to final position
    value.value = withTiming(end, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [end, start, duration, value]);

  const animationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: value.value }],
    };
  }, []);

  const isSliding = useDerivedValue(() => {
    return value.value !== start && value.value !== end;
  }, []);

  return { slideTo, animationStyle, isSliding };
};
