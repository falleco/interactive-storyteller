import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const useAnimatedBounce = (strength = 5, repeat = 1) => {
  const value = useSharedValue(0);

  const bounce = useCallback(() => {
    const timingConfig = {
      easing: Easing.bezier(0.35, 0.7, 0.5, 0.7),
      duration: 80,
    };
    value.value = withSequence(
      withTiming(strength, timingConfig),
      withRepeat(withTiming(-strength, timingConfig), repeat, true),
      withSpring(0, {
        mass: 0.5,
      }),
    );
  }, [repeat, strength, value]);

  const rStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: value.value }],
    };
  }, []);

  const isBouncing = useDerivedValue(() => {
    return value.value !== 0;
  }, []);

  return { bounce, rStyle, isBouncing };
};
