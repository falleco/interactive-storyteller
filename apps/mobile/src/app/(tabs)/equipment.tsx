import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function EquipmentTab() {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-1 items-center justify-center px-6">
        <ThemedText className="text-3xl font-black mb-2">Tab Two</ThemedText>
        <ThemedText className="text-base text-gray-500 text-center">
          Placeholder for the second tab.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
