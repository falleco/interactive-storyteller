import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { TabIconProps } from './core/tab-bar-button';

/**
 * Map of route name → tab icon component. Each component receives `color`
 * and `size`, matching the `TabIconProps` contract expected by the custom
 * TabBar. Adding a new tab? Register its icon here.
 *
 * MaterialCommunityIcons covers the iconography on both iOS and Android
 * with consistent glyphs, so the bar looks identical across platforms.
 */
export const icons = {
  index: ({ color, size = 26 }: TabIconProps) => (
    <MaterialCommunityIcons
      name="book-open-variant"
      color={color}
      size={size}
    />
  ),
  family: ({ color, size = 26 }: TabIconProps) => (
    <MaterialCommunityIcons name="account-group" color={color} size={size} />
  ),
};
