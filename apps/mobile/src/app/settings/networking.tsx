import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader, SettingsList, useAppSettings } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function NetworkingScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { appSettings, updateNetworking } = useAppSettings();

  const handleClose = () => {
    router.back();
  };

  const handleToggle = async (key: keyof typeof appSettings.networking) => {
    const newValue = !appSettings.networking[key];
    await updateNetworking({ [key]: newValue });
  };

  const sections: SettingSection[] = [
    {
      id: 'sync',
      title: 'Data Synchronization',
      items: [
        {
          id: 'autoSync',
          title: 'Auto Sync',
          subtitle: 'Automatically sync your progress and settings',
          icon: '🔄',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.networking.autoSync,
          onPress: () => handleToggle('autoSync'),
        },
        {
          id: 'backgroundSync',
          title: 'Background Sync',
          subtitle: 'Sync data even when the app is in the background',
          icon: '📱',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.networking.backgroundSync,
          onPress: () => handleToggle('backgroundSync'),
        },
      ],
    },
    {
      id: 'data-usage',
      title: 'Data Usage',
      items: [
        {
          id: 'wifiOnly',
          title: 'WiFi Only',
          subtitle: 'Only sync when connected to WiFi to save mobile data',
          icon: '📶',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.networking.wifiOnly,
          onPress: () => handleToggle('wifiOnly'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🌐 Networking" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        <SettingsList sections={sections} />

        {/* Connection Status */}
        <View className="mt-5 p-4 bg-green-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-green-800 mb-2">
            📡 Connection Status
          </ThemedText>
          <View className="flex-row items-center">
            <View className="w-3 h-3 bg-green-500 rounded-full mr-2" />
            <ThemedText className="text-xs text-green-700">
              Connected • Last sync: Just now
            </ThemedText>
          </View>
        </View>

        {/* Data Usage Info */}
        <View className="mt-3 p-4 bg-blue-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-blue-800 mb-2">
            💾 Data Usage
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            • Auto sync keeps your progress safe across devices
          </ThemedText>
          <ThemedText className="text-xs text-blue-700 mb-2">
            • Background sync ensures you never lose progress
          </ThemedText>
          <ThemedText className="text-xs text-blue-700">
            • WiFi-only mode helps conserve mobile data
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
