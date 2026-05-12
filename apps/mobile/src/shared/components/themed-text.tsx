import { Text, type TextProps, type TextStyle } from 'react-native';
import { Colors, Typography } from '~/shared/constants/theme';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { cn } from '~/shared/lib/cn';

export type ThemedTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'body'
  | 'label'
  | 'caption'
  | 'mono'
  | 'button'
  | 'link';

type LegacyVariant =
  | 'default'
  | 'title'
  | 'defaultSemiBold'
  | 'subtitle'
  | 'link';

type Tone =
  | 'default'
  | 'muted'
  | 'accent'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning';

const variantAliases: Record<LegacyVariant, ThemedTextVariant> = {
  default: 'body',
  title: 'title',
  defaultSemiBold: 'heading',
  subtitle: 'subtitle',
  link: 'link',
};

const toneToColorKey: Record<Tone, keyof (typeof Colors)['light']> = {
  default: 'text',
  muted: 'muted',
  accent: 'accent',
  secondary: 'secondary',
  success: 'success',
  danger: 'danger',
  warning: 'warning',
};

const variantClasses: Record<ThemedTextVariant, string> = {
  display: 'font-boldpixels-medium text-[44px] leading-[48px] tracking-[2px]',
  title: 'font-pixelpurl-medium text-[34px] leading-[40px] tracking-[1px]',
  heading: 'font-pcsenior-medium text-[26px] leading-[32px] tracking-[0.8px]',
  subtitle: 'font-november-medium text-[18px] leading-[24px] tracking-[0.5px]',
  body: 'font-manaspace-medium text-[16px] leading-[22px] tracking-[0.3px]',
  label:
    'font-pixelpurl-medium uppercase text-[12px] leading-[16px] tracking-[2.2px]',
  caption:
    'font-tchaikovsky-medium text-[12px] leading-[16px] tracking-[0.5px]',
  mono: 'font-manaspace-medium text-[15px] leading-[20px] tracking-[0.4px]',
  button:
    'font-pixelpurl-medium uppercase text-[20px] leading-[26px] tracking-[2.4px]',
  link: 'font-pixelpurl-medium text-[18px] leading-[22px] tracking-[0.5px] underline',
};

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextVariant | LegacyVariant;
  tone?: Tone;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'body',
  tone = 'default',
  ...rest
}: ThemedTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const resolvedVariant =
    variantAliases[type as LegacyVariant] ?? (type as ThemedTextVariant);
  const variantClass = variantClasses[resolvedVariant] ?? variantClasses.body;

  const fallbackColorKey = toneToColorKey[tone];
  const palette = Colors[colorScheme];
  const manualColor = colorScheme === 'light' ? lightColor : darkColor;
  const defaultColor =
    manualColor ?? (palette[fallbackColorKey] as string) ?? palette.text;

  const hasColorOverride = (() => {
    if (Array.isArray(style)) {
      return style.some(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          'color' in entry &&
          entry.color != null,
      );
    }

    return Boolean(
      style &&
        typeof style === 'object' &&
        'color' in style &&
        style.color != null,
    );
  })();

  const colorClass =
    manualColor || hasColorOverride ? undefined : `[color:${defaultColor}]`;
  const inlineColor = manualColor ? { color: manualColor } : undefined;

  return (
    <Text
      className={cn(variantClass, colorClass, rest.className)}
      style={[inlineColor as TextStyle, style as TextStyle]}
      {...rest}
    />
  );
}
