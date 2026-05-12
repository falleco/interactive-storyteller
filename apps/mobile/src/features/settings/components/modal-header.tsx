import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
}

/**
 * Reusable Modal Header component with consistent styling
 * Provides title and close button functionality
 */
export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <View className="flex-row justify-between items-center backdrop-blur-sm border-b border-white/10">
      <ThemedText className="text-2xl font-black text-black">
        {title}
      </ThemedText>
      <FlatButton size="lg" onPress={onClose} className="p-0 m-0">
        <Image
          style={{ width: 64, height: 64 }}
          source={require('@/assets/images/hud/close.png')}
        />
      </FlatButton>
    </View>
  );
}
