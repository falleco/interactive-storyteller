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

import { SidebarHost } from '~/shared/components/core/sidebar-host';
import { DevMenuFab } from '~/shared/dev/dev-menu-fab';
import { AuthProvider } from '~/shared/hooks/use-auth';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { ColorSchemeProvider } from '~/shared/theme/color-scheme-context';

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

  // The persisted theme preference is restored inside <ColorSchemeProvider>
  // so it doesn't run before the provider mounts.

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
        <ColorSchemeProvider>
          <AuthProvider>
            <ThemeProvider
              value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
            >
              <SidebarHost>
                <Stack>
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
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
                      // iOS-native partial sheet ("popup" feel); on Android
                      // the runtime falls back to a full-screen modal.
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
              </SidebarHost>
            </ThemeProvider>
          </AuthProvider>
        </ColorSchemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
