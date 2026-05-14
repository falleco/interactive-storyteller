import type { TabIconProps } from './core/tab-bar-button';
import { FamilyIcon } from './icons/family-icon';
import { LibraryIcon } from './icons/library-icon';

/**
 * Map of route name → tab icon component. Each component receives `color`
 * and `size`, matching the `TabIconProps` contract expected by the custom
 * TabBar. Adding a new tab? Register its icon here.
 *
 * Uses the in-house SVG icons in `./icons/` so the bar uses the same
 * iconography as the rest of the app instead of mixing
 * `MaterialCommunityIcons` glyphs in.
 */
export const icons = {
  index: ({ color, size = 26 }: TabIconProps) => (
    <LibraryIcon color={color} size={size} />
  ),
  family: ({ color, size = 26 }: TabIconProps) => (
    <FamilyIcon color={color} size={size} />
  ),
};
