import type { ComponentType } from 'react';

export interface TabIconProps {
  color: string;
  size?: number;
}

export interface TabBarButtonProps {
  isFocused: boolean;
  Icon: ComponentType<TabIconProps>;
}

const ACTIVE_COLOR = '#0f172a';
const INACTIVE_COLOR = '#64748b';

/**
 * Renders the icon for a single tab. Vector icons don't accept reanimated
 * props through their style prop, so we toggle the colour synchronously
 * with the focused state — the moving indicator pill carries the animation
 * load, the icon just snaps to its new colour.
 */
export function TabBarButton({ isFocused, Icon }: TabBarButtonProps) {
  return <Icon color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR} size={26} />;
}
