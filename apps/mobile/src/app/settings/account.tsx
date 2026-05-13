import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '~/features/settings';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

export default function AccountScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user, isLoading, signInWithGoogle, signInWithApple, signOut } =
    useAuth();
  const [pendingProvider, setPendingProvider] = useState<
    'google' | 'apple' | 'signout' | null
  >(null);

  const handleClose = () => {
    router.back();
  };

  const runAuth = async (
    provider: 'google' | 'apple' | 'signout',
    fn: () => Promise<void>,
    errorTitle: string,
  ) => {
    setPendingProvider(provider);
    try {
      await fn();
    } catch (error) {
      Alert.alert(
        errorTitle,
        error instanceof Error ? error.message : 'Unexpected error',
      );
    } finally {
      setPendingProvider(null);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="👤 My Account" onClose={handleClose} />

      <ScrollView className="flex-1 p-5" contentContainerClassName="pb-12">
        {isLoading ? (
          <ThemedText className="text-center text-base text-gray-500 dark:text-zinc-400 mt-12">
            Loading…
          </ThemedText>
        ) : user ? (
          <SignedInView
            user={user}
            isPending={pendingProvider === 'signout'}
            onSignOut={() =>
              runAuth(
                'signout',
                async () => {
                  await signOut();
                },
                'Failed to sign out',
              )
            }
          />
        ) : (
          <SignedOutView
            pendingProvider={pendingProvider}
            onGoogle={() =>
              runAuth('google', signInWithGoogle, 'Google sign-in failed')
            }
            onApple={() =>
              runAuth('apple', signInWithApple, 'Apple sign-in failed')
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedInView({
  user,
  isPending,
  onSignOut,
}: {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  isPending: boolean;
  onSignOut: () => void;
}) {
  const displayName = user.name || user.email;
  const initial = (user.name || user.email || '?').charAt(0).toUpperCase();

  return (
    <View className="items-center">
      <View className="items-center mt-4 mb-8">
        {user.image ? (
          <Image
            source={{ uri: user.image }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
        ) : (
          <View className="w-24 h-24 rounded-full bg-purple-200 items-center justify-center">
            <ThemedText className="text-4xl font-black text-purple-900">
              {initial}
            </ThemedText>
          </View>
        )}
        <ThemedText className="mt-4 text-xl font-black text-black dark:text-white">
          {displayName}
        </ThemedText>
        <ThemedText className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
          {user.email}
        </ThemedText>
        {!user.emailVerified && (
          <ThemedText className="mt-1 text-xs text-amber-600">
            Email not verified
          </ThemedText>
        )}
      </View>

      <View className="w-full max-w-sm">
        <FlatButton
          size="lg"
          className="bg-red-500"
          isDisabled={isPending}
          onPress={onSignOut}
        >
          <FlatButtonText tone="default" className="text-white">
            {isPending ? 'Signing out…' : 'Sign out'}
          </FlatButtonText>
        </FlatButton>
      </View>
    </View>
  );
}

function SignedOutView({
  pendingProvider,
  onGoogle,
  onApple,
}: {
  pendingProvider: 'google' | 'apple' | 'signout' | null;
  onGoogle: () => void;
  onApple: () => void;
}) {
  return (
    <View className="items-center">
      <View className="items-center mt-6 mb-8 px-4">
        <ThemedText className="text-2xl font-black text-black dark:text-white text-center">
          Sign in
        </ThemedText>
        <ThemedText className="mt-2 text-sm text-gray-600 dark:text-zinc-400 text-center">
          Sync your progress across devices and never lose your wonder tales.
        </ThemedText>
      </View>

      <View className="w-full max-w-sm gap-3">
        <FlatButton
          size="lg"
          className="bg-white border border-gray-300"
          isDisabled={pendingProvider !== null}
          onPress={onGoogle}
        >
          <ThemedText className="text-base font-semibold text-black dark:text-white">
            {pendingProvider === 'google'
              ? 'Opening Google…'
              : 'Continue with Google'}
          </ThemedText>
        </FlatButton>

        {Platform.OS === 'ios' && (
          <FlatButton
            size="lg"
            className="bg-black"
            isDisabled={pendingProvider !== null}
            onPress={onApple}
          >
            <ThemedText className="text-base font-semibold text-white">
              {pendingProvider === 'apple'
                ? 'Opening Apple…'
                : ' Continue with Apple'}
            </ThemedText>
          </FlatButton>
        )}
      </View>

      <ThemedText className="mt-8 text-xs text-gray-500 dark:text-zinc-400 text-center px-6">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </ThemedText>
    </View>
  );
}
