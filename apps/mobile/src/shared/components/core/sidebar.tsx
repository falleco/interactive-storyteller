import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { ThemedText } from '../themed-text';

export interface SidebarItem {
  id: string;
  label: string;
  /** MaterialCommunityIcons name, e.g. `cog-outline`. */
  icon: string;
  onPress: () => void;
  /** Render below the rest with a different tint. */
  isDangerous?: boolean;
}

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  items: SidebarItem[];
  /** Optional header rendered above the items (e.g. avatar + name). */
  header?: React.ReactNode;
  /** Side the panel slides in from. Defaults to `left`. */
  side?: 'left' | 'right';
}

const PANEL_WIDTH_RATIO = 0.78;
const ANIM_DURATION = 240;

/**
 * Slide-in drawer panel. Built on `<Modal animationType="none">` plus a
 * reanimated translateX — RN's built-in `slide` mode only slides from the
 * bottom, so we drive the transform ourselves and pick the right
 * off-screen direction based on the `side` prop.
 */
export function Sidebar({
  visible,
  onClose,
  items,
  header,
  side = 'left',
}: SidebarProps) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const scheme = useColorScheme();
  const panelWidth = Math.min(width * PANEL_WIDTH_RATIO, 360);
  // Panel background follows the theme — StyleSheet styles can't include
  // tailwind `dark:` variants, so we pick the literal value at render time.
  const panelBackground = scheme === 'dark' ? '#0b0b14' : '#ffffff';

  // Off-screen offset: negative when entering from the left so the panel
  // sits hidden to the left of the screen; positive for the right side.
  const offscreen = side === 'left' ? -panelWidth : panelWidth;

  const translateX = useSharedValue(offscreen);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: ANIM_DURATION });
    } else {
      translateX.value = withTiming(offscreen, {
        duration: ANIM_DURATION,
        easing: Easing.in(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: ANIM_DURATION });
    }
  }, [visible, offscreen, translateX, backdropOpacity]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panelEdgeStyle = side === 'left' ? styles.panelLeft : styles.panelRight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.backdrop, backdropStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.panelBase,
            panelEdgeStyle,
            {
              width: panelWidth,
              paddingTop: top + 16,
              paddingBottom: bottom + 16,
              backgroundColor: panelBackground,
            },
            panelStyle,
          ]}
        >
          {header ? <View className="px-5 pb-4">{header}</View> : null}

          <View className="px-3 gap-1">
            {items
              .filter((i) => !i.isDangerous)
              .map((item) => (
                <SidebarRow key={item.id} item={item} onClose={onClose} />
              ))}
          </View>

          {items.some((i) => i.isDangerous) ? (
            <View className="px-3 mt-auto gap-1">
              {items
                .filter((i) => i.isDangerous)
                .map((item) => (
                  <SidebarRow key={item.id} item={item} onClose={onClose} />
                ))}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

function SidebarRow({
  item,
  onClose,
}: {
  item: SidebarItem;
  onClose: () => void;
}) {
  const scheme = useColorScheme();
  const handlePress = () => {
    onClose();
    // Defer the action so the close animation can start before any heavy
    // navigation work runs on the JS thread.
    setTimeout(() => item.onPress(), 60);
  };

  const iconColor = item.isDangerous
    ? '#dc2626'
    : scheme === 'dark'
      ? '#e2e8f0'
      : '#0f172a';

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center px-3 py-3 rounded-xl active:bg-gray-100 dark:active:bg-zinc-800"
    >
      <MaterialCommunityIcons
        // MCI's `name` is a giant union of every glyph; accept a free-form
        // string from the caller and let TS narrow at the call site.
        name={item.icon as never}
        size={22}
        color={iconColor}
      />
      <ThemedText
        className={
          item.isDangerous
            ? 'text-base font-semibold text-red-600 dark:text-red-400 ml-3'
            : 'text-base font-semibold text-black dark:text-white ml-3'
        }
      >
        {item.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  panelBase: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // backgroundColor is set inline so it can react to the theme.
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  panelLeft: {
    left: 0,
    shadowOffset: { width: 4, height: 0 },
  },
  panelRight: {
    right: 0,
    shadowOffset: { width: -4, height: 0 },
  },
});
