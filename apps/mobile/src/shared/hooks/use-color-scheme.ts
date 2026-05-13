import { useColorScheme as useNativewindColorScheme } from 'nativewind';

/**
 * Returns the effective colour scheme — `light` or `dark` — taking into
 * account the user's override from `useThemeMode`. Falls back to the
 * device's appearance when the user has selected `system`.
 *
 * We proxy through NativeWind so all tailwind `dark:` class variants and
 * this hook stay in sync.
 */
export function useColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useNativewindColorScheme();
  return colorScheme ?? 'light';
}
