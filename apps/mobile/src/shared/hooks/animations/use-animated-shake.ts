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

export const useAnimatedShake = () => {
  const value = useSharedValue(0);

  const shake = useCallback(() => {
    const TranslationAmount = 10;
    const timingConfig = {
      easing: Easing.bezier(0.35, 0.7, 0.5, 0.7),
      duration: 80,
    };
    value.value = withSequence(
      withTiming(TranslationAmount, timingConfig),
      withRepeat(withTiming(-TranslationAmount, timingConfig), 3, true),
      withSpring(0, {
        mass: 0.5,
      }),
    );
  }, []);

  const rStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: value.value }],
    };
  }, []);

  const isShaking = useDerivedValue(() => {
    return value.value !== 0;
  }, []);

  return { shake, rStyle, isShaking };
};
