import { Image, type ImageProps } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const ICON_SIZE = 72;
const FOCUS_SPRING = {
  damping: 14,
  mass: 0.7,
  stiffness: 190,
};

export interface TabBarButtonProps {
  isFocused: boolean;
  label: string;
  source: NonNullable<ImageProps['source']>;
}

export function TabBarButton({ isFocused, label, source }: TabBarButtonProps) {
  const focusProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    focusProgress.set(
      isFocused
        ? withSpring(1, FOCUS_SPRING)
        : withTiming(0, { duration: 180 }),
    );
  }, [focusProgress, isFocused]);

  const iconStyle = useAnimatedStyle(() => {
    const progress = focusProgress.get();

    return {
      opacity: interpolate(progress, [0, 1], [0.72, 1]),
      transform: [
        { translateY: interpolate(progress, [0, 1], [4, -22]) },
        { scale: interpolate(progress, [0, 1], [0.72, 0.98]) },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const progress = focusProgress.get();

    return {
      opacity: interpolate(progress, [0, 0.6, 1], [0, 0, 1]),
      transform: [
        { translateY: interpolate(progress, [0, 1], [5, 0]) },
        { scale: interpolate(progress, [0, 1], [0.92, 1]) },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.iconFrame, iconStyle]}>
        <Image
          source={source}
          style={styles.icon}
          contentFit="contain"
          recyclingKey={label}
        />
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, labelStyle]}>
        {label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    height: 86,
    justifyContent: 'center',
    overflow: 'visible',
    width: '100%',
  },
  iconFrame: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  label: {
    position: 'absolute',
    bottom: 23,
    maxWidth: 76,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
