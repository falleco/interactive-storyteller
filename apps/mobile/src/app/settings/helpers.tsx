import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameContext } from '~/features/game';
import { ModalHeader, SettingsList } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function HelpersScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const { gameSettings } = useGameContext();

  const handleClose = () => {
    router.back();
  };

  const handleToggleLabels = async () => {
    const newValue = !gameSettings.gameSettings.showNoteLabels;
    await gameSettings.updateSettings({ showNoteLabels: newValue });
  };

  const sections: SettingSection[] = [
    {
      id: 'visual-helpers',
      title: 'Visual Learning Aids',
      items: [
        {
          id: 'noteLabels',
          title: 'Note Labels',
          subtitle: 'Show note names on staff lines and spaces',
          icon: '🏷️',
          actionType: SettingActionType.TOGGLE,
          isEnabled: gameSettings.gameSettings.showNoteLabels,
          onPress: handleToggleLabels,
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🎓 Learning Helpers" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        <SettingsList sections={sections} />

        {/* Helper Examples */}
        <View className="mt-5 p-4 bg-green-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-green-800 mb-3">
            🎯 How Helpers Work
          </ThemedText>

          <View className="mb-3">
            <ThemedText className="text-sm font-semibold text-green-800 mb-1">
              📝 Note Labels:
            </ThemedText>
            <ThemedText className="text-xs text-green-700">
              Shows the note name (Do, Re, Mi or C, D, E) next to each staff
              line and space. Perfect for beginners learning note positions.
            </ThemedText>
          </View>
        </View>

        {/* Learning Strategy */}
        <View className="mt-3 p-4 bg-blue-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-blue-800 mb-2">
            📚 Learning Strategy
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            1. Start with note labels enabled to learn positions
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            2. Practice until you can identify notes quickly with labels
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            3. Turn off labels for a challenge and test your memory
          </ThemedText>
          <ThemedText className="text-xs text-blue-700">
            4. Gradually increase difficulty as you improve
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
