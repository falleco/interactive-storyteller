import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/global.css';

import { Platform } from 'react-native';
import { SidebarHost } from '~/shared/components/core/sidebar-host';
import { WonderSheetHost } from '~/shared/components/core/wonder-sheet-host';
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
                <WonderSheetHost>
                  <Stack>
                    <Stack.Screen
                      name="(tabs)"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="settings/index"
                      options={{
                        presentation: 'card',
                        animation: 'slide_from_left',
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="settings/templates/index"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="settings/templates/[id]"
                      options={{ headerShown: false }}
                    />
                    <Stack.Screen
                      name="family/me"
                      options={{
                        presentation: 'formSheet',
                        // iOS-native partial sheet ("popup" feel); on Android
                        // the runtime falls back to a bottom sheet via
                        // react-native-screens.
                        sheetAllowedDetents: [0.6, 1],
                        sheetCornerRadius: Platform.OS === 'ios' ? 64 : 24,
                        sheetGrabberVisible: true,
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="family/child/[id]"
                      options={{
                        presentation: 'formSheet',
                        sheetAllowedDetents: [0.6, 1],
                        sheetCornerRadius: Platform.OS === 'ios' ? 64 : 24,
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
                  </Stack>
                  <DevMenuFab />
                  {/* StatusBar is controlled inside <ColorSchemeProvider> so
                      its style can defer until the theme-reveal animation
                      completes — don't double-mount it here. */}
                </WonderSheetHost>
              </SidebarHost>
            </ThemeProvider>
          </AuthProvider>
        </ColorSchemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
