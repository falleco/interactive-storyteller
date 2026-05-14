import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

const BACK_BUTTON_SIZE = 44;

/**
 * Stack-screen header in the book reader's style: a circular back
 * chevron on the left + title in the app's bold font next to it.
 * Replaces the older `<ModalHeader>` (emoji title + close button) on
 * screens where we hide the native navigator header.
 *
 * The `lineHeight` on the title is locked to the chevron's height so
 * the type aligns with the optical centre of the button, regardless
 * of font metrics — same trick used in `SlideHeader`.
 */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  /** Optional trailing slot (e.g. an action button). Sized to balance
   *  the chevron button on the left so the title stays visually
   *  anchored. */
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: insets.top + 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 12,
        gap: 12,
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        className="rounded-full bg-black/10 dark:bg-white/10 items-center justify-center"
        style={{ width: BACK_BUTTON_SIZE, height: BACK_BUTTON_SIZE }}
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={24}
          color={iconColor}
        />
      </Pressable>
      <ThemedText
        numberOfLines={1}
        style={{ flex: 1, lineHeight: BACK_BUTTON_SIZE }}
        className="text-2xl font-black text-black dark:text-white"
      >
        {title}
      </ThemedText>
      {right}
    </View>
  );
}
