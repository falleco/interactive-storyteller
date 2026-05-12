import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { XIcon } from 'phosphor-react-native';
import type React from 'react';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { cn } from '~/shared/lib/cn';

const audioSource = require('@/assets/sfx/interface-click-1-1.wav');

type FloatingButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface FloatingButtonProps {
  size?: FloatingButtonSize;
  isDisabled?: boolean;
  onPress?: () => void;
  className?: string;
  hapticFeedback?: boolean;
}

const getSizeStyles = (size: FloatingButtonSize) => {
  switch (size) {
    case 'xs':
      return 'px-3 py-2';
    case 'sm':
      return 'px-4 py-2';
    case 'md':
      return 'px-5 py-3';
    case 'lg':
      return 'px-6 py-4';
    case 'xl':
      return 'px-8 py-4';
  }
};

export function FloatingButton({
  size = 'md',
  isDisabled = false,
  onPress,
  className,
  hapticFeedback = true,
}: FloatingButtonProps) {
  const player = useAudioPlayer(audioSource);
  const [isPressed, setIsPressed] = useState(false);
  const handlePress = () => {
    if (isDisabled || !onPress) return;

    player.seekTo(0);
    player.play();

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  const baseStyles =
    'flex-row items-center justify-center bg-black rounded-full w-20 h-20 text-white p-0 m-0 border-2 border-white';
  const sizeStyles = getSizeStyles(size);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={isDisabled}
      className={cn(
        baseStyles,
        sizeStyles,
        isDisabled && 'opacity-50',
        className,
        isPressed && 'opacity-50',
      )}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.55 : 1 }],
      })}
    >
      <XIcon size={36} weight="bold" color="white" />
    </Pressable>
  );
}
