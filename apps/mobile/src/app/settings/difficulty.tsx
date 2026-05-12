import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameContext } from '~/features/game';
import { ModalHeader, SettingOption } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { Difficulty } from '~/shared/types/music';

export default function DifficultyScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const { gameSettings } = useGameContext();

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🎯 Difficulty" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        <SettingOption
          title="Note Range"
          subtitle="Controls which notes appear in the game"
          options={[
            {
              label: 'Beginner',
              value: Difficulty.BEGINNER,
              description: 'C4 to B5 - Basic treble clef range (9 notes)',
            },
            {
              label: 'Intermediate',
              value: Difficulty.INTERMEDIATE,
              description:
                'C3 to B5 - Extended range with ledger lines (16 notes)',
            },
            {
              label: 'Advanced',
              value: Difficulty.ADVANCED,
              description:
                'C3 to B6 - Full range with many ledger lines (21 notes)',
            },
          ]}
          currentValue={gameSettings.gameSettings.difficulty}
          onValueChange={(value) => gameSettings.updateDifficulty(value)}
        />

        {/* Difficulty Explanation */}
        <View className="mt-6 p-4 bg-yellow-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-yellow-800 mb-3">
            📊 Difficulty Breakdown
          </ThemedText>

          <View className="mb-3">
            <ThemedText className="text-sm font-semibold text-yellow-800 mb-1">
              🟢 Beginner (C4-B5):
            </ThemedText>
            <ThemedText className="text-xs text-yellow-700">
              Notes stay within the main staff lines. Perfect for learning basic
              note positions.
            </ThemedText>
          </View>

          <View className="mb-3">
            <ThemedText className="text-sm font-semibold text-yellow-800 mb-1">
              🟡 Intermediate (C3-B5):
            </ThemedText>
            <ThemedText className="text-xs text-yellow-700">
              Includes ledger lines below the staff. Introduces middle C and
              lower notes.
            </ThemedText>
          </View>

          <View>
            <ThemedText className="text-sm font-semibold text-yellow-800 mb-1">
              🔴 Advanced (C3-B6):
            </ThemedText>
            <ThemedText className="text-xs text-yellow-700">
              Full range with ledger lines above and below. Challenges even
              experienced musicians.
            </ThemedText>
          </View>
        </View>

        {/* Progress Tips */}
        <View className="mt-3 p-4 bg-green-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-green-800 mb-2">
            🎯 Progression Tips
          </ThemedText>
          <ThemedText className="text-xs text-green-700 mb-2">
            • Master beginner level with 90%+ accuracy before advancing
          </ThemedText>
          <ThemedText className="text-xs text-green-700 mb-2">
            • Practice ledger line notes separately before trying intermediate
          </ThemedText>
          <ThemedText className="text-xs text-green-700">
            • Advanced level prepares you for real sheet music reading
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
