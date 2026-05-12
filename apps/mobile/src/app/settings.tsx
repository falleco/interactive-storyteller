import { router } from 'expo-router';
import type React from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameContext } from '~/features/game';
import { ModalHeader, SettingsList, useAppSettings } from '~/features/settings';
import { FloatingButton } from '~/shared/components/core/floating-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/music';
import { SettingActionType } from '~/shared/types/music';

export default function SettingsScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { appSettings, updateUsername, toggleConnection } = useAppSettings();
  const { gameSettings } = useGameContext();

  const handleClose = () => {
    router.back();
  };

  const handleChangeUsername = () => {
    Alert.prompt(
      'Change Username',
      'Enter your new username:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (text?: string) => {
            if (text?.trim()) {
              await updateUsername(text.trim());
              Alert.alert('Success', 'Username updated successfully!');
            }
          },
        },
      ],
      'plain-text',
      appSettings.username,
    );
  };

  const handleConnectToSave = async () => {
    await toggleConnection();
    Alert.alert(
      appSettings.isConnected ? 'Disconnected' : 'Connected',
      appSettings.isConnected
        ? 'Your progress will no longer be synced'
        : 'Your progress is now being synced to the cloud',
    );
  };

  const handleComingSoon = (feature: string) => {
    Alert.alert(
      'Coming Soon',
      `${feature} will be available in a future update!`,
      [{ text: 'OK' }],
    );
  };

  const sections: SettingSection[] = [
    {
      id: 'account',
      title: 'My Account',
      items: [
        {
          id: 'account-info',
          title: 'Account',
          subtitle: `Signed in as ${appSettings.username}`,
          icon: '👤',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/account',
        },
        {
          id: 'username',
          title: 'Change Username',
          subtitle: `Current: ${appSettings.username}`,
          icon: '✏️',
          actionType: SettingActionType.ACTION,
          onPress: handleChangeUsername,
        },
        {
          id: 'connect',
          title: 'Connect to Save Progress',
          subtitle: appSettings.isConnected ? 'Connected' : 'Not connected',
          icon: appSettings.isConnected ? '☁️' : '📱',
          actionType: SettingActionType.TOGGLE,
          isEnabled: appSettings.isConnected,
          onPress: handleConnectToSave,
        },
      ],
    },
    {
      id: 'gameplay',
      title: 'Gameplay',
      items: [
        {
          id: 'music-notation',
          title: 'Music Notation',
          subtitle: `Current: ${gameSettings.gameSettings.notationSystem === 'solfege' ? 'Solfege' : 'Letter Names'}`,
          icon: '🎼',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/music-notation',
        },
        {
          id: 'difficulty',
          title: 'Difficulty',
          subtitle: `Current: ${gameSettings.gameSettings.difficulty.charAt(0).toUpperCase() + gameSettings.gameSettings.difficulty.slice(1)}`,
          icon: '🎯',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/difficulty',
        },
        {
          id: 'helpers',
          title: 'Learning Helpers',
          subtitle: `Note labels: ${gameSettings.gameSettings.showNoteLabels ? 'Visible' : 'Hidden'}`,
          icon: '🎓',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/helpers',
        },
      ],
    },
    {
      id: 'general',
      title: 'General',
      items: [
        {
          id: 'push-notifications',
          title: 'Push Notifications',
          subtitle: appSettings.pushNotifications.enabled
            ? 'Enabled'
            : 'Disabled',
          icon: '🔔',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/push-notifications',
        },
        {
          id: 'sound-vibrations',
          title: 'Sound and Vibrations',
          subtitle: `Volume: ${appSettings.soundAndVibrations.volume}%`,
          icon: '🔊',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/sound-vibrations',
        },
        {
          id: 'graphics',
          title: 'Graphics',
          subtitle: `Quality: ${appSettings.graphics.quality.charAt(0).toUpperCase() + appSettings.graphics.quality.slice(1)}`,
          icon: '🎨',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/graphics',
        },
        {
          id: 'networking',
          title: 'Networking',
          subtitle: appSettings.networking.autoSync
            ? 'Auto sync enabled'
            : 'Manual sync only',
          icon: '🌐',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/networking',
        },
        {
          id: 'bug-report',
          title: 'Bug Report',
          subtitle: 'Report issues or suggest improvements',
          icon: '🐛',
          actionType: SettingActionType.ACTION,
          onPress: () => handleComingSoon('Bug reporting'),
        },
        {
          id: 'check-update',
          title: 'Check for Updates',
          subtitle: 'See if a new version is available',
          icon: '🔄',
          actionType: SettingActionType.ACTION,
          onPress: () => handleComingSoon('Update checking'),
        },
      ],
    },
    {
      id: 'info',
      title: 'Info',
      items: [
        {
          id: 'rate-app',
          title: 'Rate on App Store',
          subtitle: 'Help us by leaving a review',
          icon: '⭐',
          actionType: SettingActionType.EXTERNAL_LINK,
          externalUrl: 'https://apps.apple.com',
        },
        {
          id: 'twitter',
          title: 'Twitter',
          subtitle: 'Follow us for updates and tips',
          icon: '🐦',
          actionType: SettingActionType.EXTERNAL_LINK,
          externalUrl: 'https://twitter.com',
        },
        {
          id: 'credits',
          title: 'Credits',
          subtitle: 'Meet the team behind Staff Hero',
          icon: '👥',
          actionType: SettingActionType.ACTION,
          onPress: () => handleComingSoon('Credits'),
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          subtitle: 'Legal terms and conditions',
          icon: '📄',
          actionType: SettingActionType.EXTERNAL_LINK,
          externalUrl: 'https://example.com/terms',
        },
        {
          id: 'privacy',
          title: 'Privacy Policy',
          subtitle: 'How we protect your data',
          icon: '🔒',
          actionType: SettingActionType.EXTERNAL_LINK,
          externalUrl: 'https://example.com/privacy',
        },
      ],
    },
    {
      id: 'danger',
      title: 'Danger Zone',
      items: [
        {
          id: 'delete-account',
          title: 'Delete Account',
          subtitle: 'Permanently delete your account and all data',
          icon: '🗑️',
          actionType: SettingActionType.ACTION,
          isDangerous: true,
          onPress: () => {
            Alert.alert(
              'Delete Account',
              'This will permanently delete your account and all game data. This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => handleComingSoon('Account deletion'),
                },
              ],
            );
          },
        },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ScrollView className="flex-1 p-5" contentContainerClassName="pb-20">
        <SettingsList sections={sections} />
      </ScrollView>
      <View className="absolute bottom-10 right-0 left-0 justify-center items-center p-0 m-0">
        <FloatingButton
          size="lg"
          className="self-center"
          onPress={handleClose}
        />
      </View>
    </SafeAreaView>
  );
}
