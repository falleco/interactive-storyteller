import { COLORS, type ColorType } from '~/theme/colors';

type AnimatedSvgProps = any;

export type IconProps = {
  size?: number;
  color?: ColorType;
  animatedProps?: AnimatedSvgProps;
};

/** Resolve a ColorType key to its hex string value. */
export const resolveColor = (color: ColorType): string =>
  COLORS[color] as string;
