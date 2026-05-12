import { router } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsList } from '~/features/settings';
import { FloatingButton } from '~/shared/components/core/floating-button';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { SettingSection } from '~/shared/types/settings';
import { SettingActionType } from '~/shared/types/settings';

export default function SettingsScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();

  const handleClose = () => {
    router.back();
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
          subtitle: user
            ? `Signed in as ${user.name || user.email}`
            : 'Not signed in',
          icon: '👤',
          actionType: SettingActionType.NAVIGATION,
          route: '/settings/account',
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
