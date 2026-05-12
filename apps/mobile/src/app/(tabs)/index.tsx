import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '~/shared/components/themed-text';
import { IconSymbol } from '~/shared/components/ui/icon-symbol';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function HomeTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'text');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="flex-row justify-end px-5 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          hitSlop={12}
          className="p-2"
        >
          <IconSymbol name="gearshape.fill" size={26} color={iconColor} />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <ThemedText className="text-3xl font-black mb-2">Home</ThemedText>
        <ThemedText className="text-base text-gray-500 text-center">
          Placeholder for the Home tab.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
