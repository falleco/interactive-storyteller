import { COLORS, type ColorType } from '~/theme/colors';

type AnimatedSvgProps = any;

export type IconProps = {
  size?: number;
  /**
   * Either a design-system token from `~/theme/colors` (e.g. `'white'`,
   * `'primary'`) or a raw color string (`'#0f172a'`, `'rgba(0,0,0,0.5)'`).
   * Tokens are resolved through the `COLORS` map; anything else is
   * passed straight through to SVG `fill`.
   */
  color?: ColorType | (string & {});
  animatedProps?: AnimatedSvgProps;
};

/**
 * Resolve a colour input to a string SVG `fill` accepts. Looks up the
 * `COLORS` map first (so tokens still work); falls back to returning
 * the raw input so callers can use hex/rgba directly when needed —
 * notably the tab bar's active/inactive states.
 */
export const resolveColor = (color: ColorType | string): string => {
  const fromMap = (COLORS as Record<string, string>)[color];
  return fromMap ?? (color as string);
};
