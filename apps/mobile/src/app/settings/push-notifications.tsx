import { router } from 'expo-router';
import type React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader, SettingsList, useAppSettings } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function PushNotificationsScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { appSettings, updatePushNotifications } = useAppSettings();

  const handleClose = () => {
    router.back();
  };

  const handleToggle = async (
    key: keyof typeof appSettings.pushNotifications,
  ) => {
    const newValue = !appSettings.pushNotifications[key];
    await updatePushNotifications({ [key]: newValue });
  };

  const sections: SettingSection[] = [
    {
      id: 'notifications',
      title: 'Push Notifications',
      items: [
        {
          id: 'enabled',
          title: 'Enable Notifications',
          subtitle: 'Allow the app to send push notifications',
          icon: '🔔',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.pushNotifications.enabled,
          onPress: () => handleToggle('enabled'),
        },
        {
          id: 'challenges',
          title: 'Challenge Updates',
          subtitle: 'Get notified about new challenges and progress',
          icon: '🏆',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.pushNotifications.challenges,
          onPress: () => handleToggle('challenges'),
        },
        {
          id: 'achievements',
          title: 'Achievement Unlocks',
          subtitle: 'Celebrate when you unlock new achievements',
          icon: '🎉',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.pushNotifications.achievements,
          onPress: () => handleToggle('achievements'),
        },
        {
          id: 'dailyReminders',
          title: 'Daily Practice Reminders',
          subtitle: 'Gentle reminders to keep practicing',
          icon: '⏰',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.pushNotifications.dailyReminders,
          onPress: () => handleToggle('dailyReminders'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🔔 Push Notifications" onClose={handleClose} />

      <ScrollView className="flex-1 p-5">
        <SettingsList sections={sections} />

        {/* Info Section */}
        <View className="mt-5 p-4 bg-blue-50 rounded-xl">
          <ThemedText className="text-sm font-medium text-blue-800 mb-2">
            💡 About Notifications
          </ThemedText>
          <ThemedText className="text-xs text-blue-700">
            Push notifications help you stay engaged with your musical journey.
            You can customize which types of notifications you receive to match
            your preferences.
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
