import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ModalHeader,
  SettingOption,
  SettingsList,
  useAppSettings,
} from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function GraphicsScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const { appSettings, updateGraphics } = useAppSettings();

  const handleClose = () => {
    router.back();
  };

  const handleToggle = async (key: keyof typeof appSettings.graphics) => {
    if (key === 'quality' || key === 'frameRate') return; // Handled separately
    const newValue = !appSettings.graphics[key];
    await updateGraphics({ [key]: newValue });
  };

  const sections: SettingSection[] = [
    {
      id: 'visual-effects',
      title: 'Visual Effects',
      items: [
        {
          id: 'animations',
          title: 'Animations',
          subtitle: 'Enable smooth transitions and animations',
          icon: '✨',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.graphics.animations,
          onPress: () => handleToggle('animations'),
        },
        {
          id: 'particleEffects',
          title: 'Particle Effects',
          subtitle: 'Show visual effects for correct answers and streaks',
          icon: '🎆',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.graphics.particleEffects,
          onPress: () => handleToggle('particleEffects'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🎨 Graphics" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        {/* Graphics Quality */}
        <View className="mb-6">
          <SettingOption
            title="Graphics Quality"
            subtitle="Choose the visual quality level"
            options={[
              {
                label: 'Low',
                value: 'low',
                description: 'Better performance, reduced visual effects',
              },
              {
                label: 'Medium',
                value: 'medium',
                description: 'Balanced performance and visuals',
              },
              {
                label: 'High',
                value: 'high',
                description: 'Best visuals, may impact performance',
              },
            ]}
            currentValue={appSettings.graphics.quality}
            onValueChange={(value) => updateGraphics({ quality: value })}
          />
        </View>

        {/* Frame Rate */}
        <View className="mb-6">
          <SettingOption
            title="Frame Rate"
            subtitle="Choose the target frame rate for animations"
            options={[
              {
                label: '30 FPS',
                value: 30,
                description: 'Standard frame rate, better battery life',
              },
              {
                label: '60 FPS',
                value: 60,
                description: 'Smooth animations, higher battery usage',
              },
            ]}
            currentValue={appSettings.graphics.frameRate}
            onValueChange={(value) => updateGraphics({ frameRate: value })}
          />
        </View>

        <SettingsList sections={sections} />

        {/* Performance Info */}
        <View className="mt-5 p-4 bg-orange-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-orange-800 mb-2">
            ⚡ Performance Tips
          </ThemedText>
          <ThemedText className="text-xs text-orange-700 mb-2">
            • Lower graphics settings can improve performance on older devices
          </ThemedText>
          <ThemedText className="text-xs text-orange-700 mb-2">
            • Disable particle effects if you experience frame drops
          </ThemedText>
          <ThemedText className="text-xs text-orange-700">
            • 30 FPS provides smoother gameplay while conserving battery
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
