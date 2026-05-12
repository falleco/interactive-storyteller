import * as Haptics from 'expo-haptics';
import type React from 'react';
import { Pressable } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { cn } from '~/shared/lib/cn';

type ButtonAction =
  | 'primary'
  | 'secondary'
  | 'positive'
  | 'negative'
  | 'default';
type ButtonVariant = 'solid' | 'outline' | 'link';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface GluestackButtonProps {
  children: React.ReactNode;
  action?: ButtonAction;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isDisabled?: boolean;
  onPress?: () => void;
  className?: string;
  hapticFeedback?: boolean;
}

interface GluestackButtonTextProps {
  children: React.ReactNode;
  className?: string;
}

// Game-style gradient mappings for actions
const getActionStyles = (action: ButtonAction, variant: ButtonVariant) => {
  if (variant === 'solid') {
    switch (action) {
      case 'primary':
        return 'bg-gradient-to-r from-blue-500 to-purple-600 border-white/20 border-2 shadow-2xl';
      case 'secondary':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 border-white/20 border-2 shadow-xl';
      case 'positive':
        return 'bg-gradient-to-r from-green-500 to-emerald-600 border-white/20 border-2 shadow-2xl';
      case 'negative':
        return 'bg-gradient-to-r from-red-500 to-red-600 border-white/20 border-2 shadow-xl';
      case 'default':
        return 'bg-black/20 backdrop-blur-sm border-white/30 border-2';
    }
  }
  if (variant === 'outline') {
    switch (action) {
      case 'primary':
        return 'bg-transparent border-2 border-blue-500';
      case 'secondary':
        return 'bg-transparent border-2 border-purple-500';
      case 'positive':
        return 'bg-transparent border-2 border-green-500';
      case 'negative':
        return 'bg-transparent border-2 border-red-500';
      case 'default':
        return 'bg-transparent border-2 border-white/30';
    }
  }

  // link variant
  return 'bg-transparent';
};

const getSizeStyles = (size: ButtonSize) => {
  switch (size) {
    case 'xs':
      return 'px-3 py-2 rounded-lg';
    case 'sm':
      return 'px-4 py-2 rounded-xl';
    case 'md':
      return 'px-5 py-3 rounded-xl';
    case 'lg':
      return 'px-6 py-4 rounded-2xl';
    case 'xl':
      return 'px-8 py-4 rounded-2xl';
  }
};

export function Button({
  children,
  action = 'primary',
  variant = 'solid',
  size = 'md',
  isDisabled = false,
  onPress,
  className,
  hapticFeedback = true,
}: GluestackButtonProps) {
  const handlePress = () => {
    if (isDisabled || !onPress) return;

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress();
  };

  const baseStyles = 'flex-row items-center justify-center';
  const actionStyles = getActionStyles(action, variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={cn(
        baseStyles,
        actionStyles,
        sizeStyles,
        isDisabled && 'opacity-50',
        className,
      )}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      {children}
      {/* Shine effect for solid variants */}
      {variant === 'solid' && (
        <ThemedText className="absolute top-1 left-1 right-1 h-4 bg-white/20 rounded-xl opacity-60" />
      )}
    </Pressable>
  );
}

export function ButtonText({ children, className }: GluestackButtonTextProps) {
  return (
    <ThemedText className={cn('text-center', className)}>{children}</ThemedText>
  );
}
