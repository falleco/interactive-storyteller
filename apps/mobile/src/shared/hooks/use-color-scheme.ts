import { useColorScheme as useNativewindColorScheme } from 'nativewind';

/**
 * Returns the effective colour scheme — `light` or `dark`. Proxied through
 * NativeWind so this stays in sync with all tailwind `dark:` variants AND
 * the override applied by `ColorSchemeProvider` when the user toggles via
 * `useColorSchemeContext`.
 */
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useNativewindColorScheme();
  return colorScheme ?? 'light';
}
