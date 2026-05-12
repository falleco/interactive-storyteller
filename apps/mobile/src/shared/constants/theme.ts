import { Platform } from 'react-native';

const palette = {
  void: '#07050F',
  midnight: '#0D0A1C',
  eclipse: '#181331',
  nebula: '#241C4B',
  aurora: '#FF9F1C',
  nova: '#FF5DA2',
  neon: '#5EF2FF',
  ember: '#FF6B6B',
  verdant: '#7CFFB2',
  warning: '#FFD56F',
  starlight: '#F6ECFF',
  moonlight: '#E6DEFF',
  frost: '#F8F5FF',
  shadow: '#2D2546',
  outlineLight: '#CAB8FF',
  outlineDark: '#2A203F',
  slate: '#8F8AB8',
};

export const Colors = {
  light: {
    text: '#2B2353',
    background: palette.frost,
    surface: '#FFFFFF',
    elevated: palette.moonlight,
    muted: palette.slate,
    accent: palette.nova,
    secondary: palette.aurora,
    success: palette.verdant,
    danger: palette.ember,
    warning: palette.warning,
    tint: palette.nova,
    icon: '#7F79A8',
    tabIconDefault: '#BDB6EA',
    tabIconSelected: palette.nova,
    outline: palette.outlineLight,
  },
  dark: {
    text: palette.starlight,
    background: palette.void,
    surface: palette.midnight,
    elevated: palette.eclipse,
    muted: '#B3ACE3',
    accent: palette.nova,
    secondary: palette.neon,
    success: palette.verdant,
    danger: palette.ember,
    warning: palette.warning,
    tint: palette.nova,
    icon: '#9C96CC',
    tabIconDefault: '#514C74',
    tabIconSelected: palette.nova,
    outline: palette.outlineDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Typography = {
  display: {
    fontFamily: 'BoldPixels-Medium',
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 2,
  },
  title: {
    fontFamily: 'PixelPurl-Medium',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 1,
  },
  heading: {
    fontFamily: 'PCSenior-Medium',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontFamily: 'November-Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  body: {
    fontFamily: 'Manaspace-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  label: {
    fontFamily: 'PixelPurl-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: 'Tchaikovsky-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  button: {
    fontFamily: 'PixelPurl-Medium',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontFamily: 'Manaspace-Medium',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.4,
  },
  link: {
    fontFamily: 'PixelPurl-Medium',
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
};
