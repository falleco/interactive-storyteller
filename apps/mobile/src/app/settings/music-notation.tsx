import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameContext } from '~/features/game';
import { ModalHeader, SettingOption } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { NotationSystem } from '~/shared/types/music';

export default function MusicNotationScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const { gameSettings } = useGameContext();

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🎼 Music Notation" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        <SettingOption
          title="Notation System"
          subtitle="Choose how notes are displayed throughout the game"
          options={[
            {
              label: 'Solfege',
              value: NotationSystem.SOLFEGE,
              description:
                'Do, Re, Mi, Fa, Sol, La, Si (Recommended for beginners)',
            },
            {
              label: 'Letter Names',
              value: NotationSystem.LETTER,
              description: 'C, D, E, F, G, A, B (Traditional notation)',
            },
          ]}
          currentValue={gameSettings.gameSettings.notationSystem}
          onValueChange={(value) => gameSettings.updateNotationSystem(value)}
        />

        {/* Notation Examples */}
        <View className="mt-6 p-4 bg-purple-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-purple-800 mb-3">
            🎵 Notation Examples
          </ThemedText>

          <View className="mb-3">
            <ThemedText className="text-sm font-semibold text-purple-800 mb-1">
              Solfege System:
            </ThemedText>
            <ThemedText className="text-xs text-purple-700">
              Do, Re, Mi, Fa, Sol, La, Si
            </ThemedText>
            <ThemedText className="text-xs text-purple-600 mt-1">
              Great for ear training and vocal music. Each syllable has a
              distinct sound.
            </ThemedText>
          </View>

          <View>
            <ThemedText className="text-sm font-semibold text-purple-800 mb-1">
              Letter Names:
            </ThemedText>
            <ThemedText className="text-xs text-purple-700">
              C, D, E, F, G, A, B
            </ThemedText>
            <ThemedText className="text-xs text-purple-600 mt-1">
              Standard in Western music theory. Used in most sheet music and
              chord charts.
            </ThemedText>
          </View>
        </View>

        {/* Learning Tips */}
        <View className="mt-3 p-4 bg-blue-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-blue-800 mb-2">
            📚 Learning Tips
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            • Start with Solfege if you're new to music - it's easier to sing
            and remember
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            • Switch to Letter Names once you're comfortable with note positions
          </ThemedText>
          <ThemedText className="text-xs text-blue-700">
            • You can change this setting anytime without losing progress
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
