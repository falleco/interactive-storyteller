import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader, SettingsList, useAppSettings } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function SoundVibrationsScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');
  const { appSettings, updateSoundAndVibrations } = useAppSettings();

  const handleClose = () => {
    router.back();
  };

  const handleToggle = async (
    key: keyof typeof appSettings.soundAndVibrations,
  ) => {
    if (key === 'volume') return; // Volume is handled separately
    const newValue = !appSettings.soundAndVibrations[key];
    await updateSoundAndVibrations({ [key]: newValue });
  };

  const handleVolumeChange = async (volume: number) => {
    await updateSoundAndVibrations({ volume: Math.round(volume) });
  };

  const sections: SettingSection[] = [
    {
      id: 'audio',
      title: 'Audio Settings',
      items: [
        {
          id: 'soundEffects',
          title: 'Sound Effects',
          subtitle: 'Play sounds for game actions and feedback',
          icon: '🔊',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.soundAndVibrations.soundEffects,
          onPress: () => handleToggle('soundEffects'),
        },
        {
          id: 'music',
          title: 'Background Music',
          subtitle: 'Play ambient music during gameplay',
          icon: '🎵',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.soundAndVibrations.music,
          onPress: () => handleToggle('music'),
        },
      ],
    },
    {
      id: 'haptics',
      title: 'Haptic Feedback',
      items: [
        {
          id: 'hapticFeedback',
          title: 'Vibration Feedback',
          subtitle: 'Feel tactile responses for correct and incorrect answers',
          icon: '📳',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.soundAndVibrations.hapticFeedback,
          onPress: () => handleToggle('hapticFeedback'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🔊 Sound & Vibrations" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        {/* Volume Control */}
        <View className="mb-6">
          <View className="p-4 rounded-xl" style={{ backgroundColor }}>
            <View className="flex-row items-center justify-between mb-3">
              <ThemedText
                className="text-lg font-bold"
                style={{ color: textColor }}
              >
                🔊 Master Volume
              </ThemedText>
              <ThemedText
                className="text-lg font-bold"
                style={{ color: primaryColor }}
              >
                {appSettings.soundAndVibrations.volume}%
              </ThemedText>
            </View>
            {/* Volume slider placeholder - would use @react-native-community/slider in real app */}
            <View className="h-2 bg-gray-200 rounded-full">
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: primaryColor,
                  width: `${appSettings.soundAndVibrations.volume}%`,
                }}
              />
            </View>
            <View className="flex-row justify-between mt-2">
              <ThemedText
                className="text-xs"
                style={{ color: secondaryTextColor }}
              >
                Mute
              </ThemedText>
              <ThemedText
                className="text-xs"
                style={{ color: secondaryTextColor }}
              >
                Max
              </ThemedText>
            </View>
          </View>
        </View>

        <SettingsList sections={sections} />

        {/* Info Section */}
        <View className="mt-5 p-4 bg-green-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-green-800 mb-2">
            🎧 Audio Tips
          </ThemedText>
          <ThemedText className="text-xs text-green-700 mb-2">
            • Sound effects help with immediate feedback during gameplay
          </ThemedText>
          <ThemedText className="text-xs text-green-700 mb-2">
            • Background music can enhance focus and immersion
          </ThemedText>
          <ThemedText className="text-xs text-green-700">
            • Haptic feedback provides tactile confirmation of your actions
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
