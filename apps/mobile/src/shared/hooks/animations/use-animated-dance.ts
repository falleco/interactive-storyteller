import { useCallback } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const useAnimatedDance = () => {
  const danceRotation = useSharedValue(0);
  const danceScale = useSharedValue(1);
  const danceY = useSharedValue(0);

  const dance = useCallback(
    (level = 0) => {
      if (level === 0) {
        // No streak - stop dancing
        danceRotation.value = withTiming(0, { duration: 300 });
        danceScale.value = withTiming(1, { duration: 300 });
        danceY.value = withTiming(0, { duration: 300 });
      } else if (level === 1) {
        // Level 1 - Gentle sway
        danceRotation.value = withRepeat(
          withSequence(
            withTiming(3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
            withTiming(-3, {
              duration: 1000,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          true,
        );
        danceScale.value = withTiming(1, { duration: 300 });
        danceY.value = withTiming(0, { duration: 300 });
      } else if (level === 2) {
        // Level 2 - More energetic with scale
        danceRotation.value = withRepeat(
          withSequence(
            withTiming(5, { duration: 600, easing: Easing.inOut(Easing.sin) }),
            withTiming(-5, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
        danceScale.value = withRepeat(
          withSequence(
            withTiming(1.1, {
              duration: 600,
              easing: Easing.inOut(Easing.quad),
            }),
            withTiming(0.95, {
              duration: 600,
              easing: Easing.inOut(Easing.quad),
            }),
          ),
          -1,
          true,
        );
        danceY.value = withTiming(0, { duration: 300 });
      } else if (level >= 3) {
        // Level 3+ - Full party mode!
        danceRotation.value = withRepeat(
          withSequence(
            withTiming(8, { duration: 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(-8, { duration: 400, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
        danceScale.value = withRepeat(
          withSequence(
            withTiming(1.2, {
              duration: 400,
              easing: Easing.inOut(Easing.elastic(1.5)),
            }),
            withTiming(0.9, {
              duration: 400,
              easing: Easing.inOut(Easing.elastic(1.5)),
            }),
          ),
          -1,
          true,
        );
        danceY.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 300, easing: Easing.out(Easing.quad) }),
            withTiming(3, { duration: 300, easing: Easing.out(Easing.quad) }),
          ),
          -1,
          true,
        );
      }
    },
    [danceRotation, danceScale, danceY],
  );

  const danceStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: danceY.value },
        { rotate: `${danceRotation.value}deg` },
        { scale: danceScale.value },
      ],
    };
  });

  const isDancing = useDerivedValue(() => {
    return (
      danceRotation.value !== 0 || danceScale.value !== 1 || danceY.value !== 0
    );
  }, []);

  return { dance, danceStyle, isDancing };
};
