import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';

import { DevMenuFab } from '~/shared/dev/dev-menu-fab';
import { AuthProvider } from '~/shared/hooks/use-auth';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { loadStoredThemeMode } from '~/shared/hooks/use-theme-mode';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'PixelPurl-Medium': require('@/assets/fonts/pixelpurl.ttf'),
    'Tchaikovsky-Medium': require('@/assets/fonts/tchaikovsky.ttf'),
    'PCSenior-Medium': require('@/assets/fonts/pcsenior.ttf'),
    'November-Medium': require('@/assets/fonts/november.ttf'),
    'BoldPixels-Medium': require('@/assets/fonts/boldpixels.ttf'),
    'Manaspace-Medium': require('@/assets/fonts/manaspace.ttf'),
  });
  const colorScheme = useColorScheme();

  // Restore the user's saved theme preference before the first paint so the
  // app boots in their chosen mode instead of flashing the system default.
  useEffect(() => {
    loadStoredThemeMode();
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider
            value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
          >
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="settings"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_left',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="family"
                options={{
                  presentation: 'formSheet',
                  // iOS-native partial sheet ("popup" feel); on Android the
                  // runtime falls back to a full-screen modal.
                  sheetAllowedDetents: [0.7, 1],
                  sheetCornerRadius: 24,
                  sheetGrabberVisible: true,
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="imagine"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_bottom',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="book/[id]"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="dev-menu"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>
            <DevMenuFab />
            <StatusBar style="auto" />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
