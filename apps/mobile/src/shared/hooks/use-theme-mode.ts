import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme as nwColorScheme, useColorScheme } from 'nativewind';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@wondertales/theme-mode';

/**
 * User-selectable theme mode. `system` means "follow the device" — no
 * override stored; anything else is an explicit preference that survives
 * relaunches.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

let initialized = false;

/**
 * Restore the stored theme preference into NativeWind's runtime. Safe to
 * call multiple times — the side effect runs only on the first call.
 */
export function loadStoredThemeMode(): Promise<void> {
  if (initialized) return Promise.resolve();
  initialized = true;
  return AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        nwColorScheme.set(stored);
      }
    })
    .catch(() => undefined);
}

/**
 * Read/write the active theme preference. Wraps NativeWind's
 * `useColorScheme` so tailwind `dark:` variants follow whatever the user
 * picks; the choice is persisted to AsyncStorage.
 */
export function useThemeMode() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
        setColorScheme(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    },
    [setColorScheme],
  );

  const toggle = useCallback(() => {
    // Flip between explicit light and explicit dark; user can still reset
    // to "system" via setMode if/when we expose that UI.
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [colorScheme, setMode]);

  return {
    /** Current user preference (light/dark/system). */
    mode,
    /** Effective scheme after resolving `system` against the device. */
    effective: (colorScheme ?? 'light') as 'light' | 'dark',
    setMode,
    toggle,
  };
}
