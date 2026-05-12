import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModalHeader } from '~/features/settings';
import { ApiError, useApi } from '~/shared/api';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

interface MeResponse {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

export default function DevMenuScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user, bearerToken } = useAuth();
  const api = useApi();
  const [meResult, setMeResult] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handleClose = () => router.back();

  const handleCopyToken = async () => {
    if (!bearerToken) {
      Alert.alert('No token', 'You are not signed in.');
      return;
    }
    await Clipboard.setStringAsync(bearerToken);
    Alert.alert('Copied', 'Bearer token copied to clipboard.');
  };

  const handleLogToken = () => {
    console.log('[dev-menu] bearer token:', bearerToken);
    Alert.alert(
      'Logged',
      bearerToken
        ? 'Bearer token logged in Metro.'
        : 'No bearer token — not signed in.',
    );
  };

  const handlePingMe = async () => {
    setIsPinging(true);
    setMeResult(null);
    try {
      const me = await api.get<MeResponse>('/me');
      const formatted = JSON.stringify(me, null, 2);
      console.log('[dev-menu] GET /me ->', formatted);
      setMeResult(formatted);
    } catch (error) {
      if (error instanceof ApiError) {
        const summary = `HTTP ${error.status}${error.code ? ` (${error.code})` : ''}\n${error.message}`;
        console.error('[dev-menu] /me failed:', error);
        setMeResult(summary);
      } else {
        console.error('[dev-menu] /me failed:', error);
        setMeResult(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader title="🛠 Dev Menu" onClose={handleClose} />

      <ScrollView className="flex-1 p-5" contentContainerClassName="pb-12">
        <View className="mb-6">
          <ThemedText className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            Session
          </ThemedText>
          <View className="bg-gray-100 rounded-xl p-4">
            <ThemedText className="text-xs text-gray-600">User</ThemedText>
            <ThemedText className="text-sm font-mono text-black">
              {user
                ? `${user.name || user.email} (${user.id})`
                : 'not signed in'}
            </ThemedText>
            <ThemedText className="text-xs text-gray-600 mt-3">
              Bearer token
            </ThemedText>
            <ThemedText
              className="text-xs font-mono text-black"
              selectable
              numberOfLines={3}
            >
              {bearerToken ?? '—'}
            </ThemedText>
          </View>
        </View>

        <View className="gap-3 mb-6">
          <FlatButton
            size="lg"
            className="bg-black"
            onPress={handleCopyToken}
            isDisabled={!bearerToken}
          >
            <ThemedText className="text-base font-semibold text-white">
              📋 Copy bearer token
            </ThemedText>
          </FlatButton>

          <FlatButton
            size="lg"
            className="bg-white border border-gray-300"
            onPress={handleLogToken}
          >
            <ThemedText className="text-base font-semibold text-black">
              🪵 Log bearer token to Metro
            </ThemedText>
          </FlatButton>
        </View>

        <View>
          <ThemedText className="text-xs uppercase tracking-wider text-gray-500 mb-2">
            API
          </ThemedText>
          <FlatButton
            size="lg"
            className="bg-purple-600"
            onPress={handlePingMe}
            isDisabled={isPinging || !bearerToken}
          >
            <ThemedText className="text-base font-semibold text-white">
              {isPinging ? 'Calling…' : '📡 GET /me (auth required)'}
            </ThemedText>
          </FlatButton>
          {meResult && (
            <View className="bg-gray-100 rounded-xl p-4 mt-3">
              <ThemedText className="text-xs font-mono text-black" selectable>
                {meResult}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
