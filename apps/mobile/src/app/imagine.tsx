import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function ImagineScreen() {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="Story catalog" onClose={() => router.back()} />
      <View className="flex-1 items-center justify-center px-6">
        <ThemedText className="text-xl font-black text-black dark:text-white text-center mb-2">
          Stories are now pre-created.
        </ThemedText>
        <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center">
          Open the Stories tab to read the published catalog.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
