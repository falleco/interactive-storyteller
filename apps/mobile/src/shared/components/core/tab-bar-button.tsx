import { useAudioPlayer } from 'expo-audio';
import React, { useEffect } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  Text,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { cn } from '~/shared/lib/cn';
import { icons } from '../icons';

const audioSource = require('@/assets/sfx/interface-click-1-1.wav');

export interface TabBarButtonProps extends PressableProps {
  isFocused: boolean;
  label: string;
  routeName: string;
  color: string;
}

export const TabBarButton = (props: TabBarButtonProps) => {
  const player = useAudioPlayer(audioSource);
  const { isFocused, label, routeName, color } = props;
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(
      typeof isFocused === 'boolean' ? (isFocused ? 1 : 0) : isFocused,
      {
        duration: isFocused ? 350 : 150,
        ...(isFocused
          ? {
              dampingRatio: 0.2,
              mass: 2,
              overshootClamping: undefined,
              energyThreshold: 0.002672955976,
            }
          : {}),
      },
    );
  }, [scale, isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(scale.value, [0, 1], [1.7, 1.9]);
    const top = interpolate(scale.value, [0, 1], [0, -8]);

    return {
      transform: [{ scale: scaleValue }],
      top,
    };
  });

  const handlePress = (e: GestureResponderEvent) => {
    player.seekTo(0);
    player.play();
    props.onPress?.(e);
  };

  return (
    <Pressable
      {...props}
      onPress={handlePress}
      className={cn('flex-1 justify-between items-center')}
    >
      <Animated.View
        style={[animatedIconStyle]}
        className={cn(
          'flex-1 border-[#361848] rounded-full w-20 h-20 justify-center items-center ',
          props.className,
          // isFocused ? 'border-4 bg-[#160E22]' : 'border-0',
        )}
      >
        {icons[routeName as keyof typeof icons]({
          color,
        })}
        {isFocused && (
          <Text className="text-white text-xs p-0 -mt-2 font-pixelpurl-medium">
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
};
