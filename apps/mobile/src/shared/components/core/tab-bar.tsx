import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { icons } from '../icons';
import { GlassView } from './glass-view';
import { TabBarButton } from './tab-bar-button';

/**
 * Geometry constants exported so other components (notably the
 * `WonderSheet` blob) can compute the FAB's absolute position from
 * window dimensions + safe-area insets without re-implementing the
 * layout formula.
 */
export const TAB_BAR_HEIGHT = 68;
const TAB_BAR_OUTER_PADDING = 18;
const INNER_PADDING = 4;
const PILL_RADIUS = 999;
const CREATE_BUTTON_SIZE = 56;
export const CREATE_BUTTON_RADIUS = CREATE_BUTTON_SIZE / 2;

/** Matches the runtime formula used in `TabBar` for paddingBottom. */
export function tabBarPaddingBottom(bottomInset: number): number {
  return bottomInset > 0 ? Math.max(bottomInset - 22, 6) : 12;
}

// Slide animation for the active-tab indicator pill.
const SLIDE_DURATION = 380;
const SLIDE_EASING = Easing.bezier(0.4, 0, 0.1, 1);
// Two-phase squeeze that makes the pill feel rubbery as it moves.
const STRETCH_SCALE = 1.12;
const STRETCH_UP_DURATION = 150;
const STRETCH_UP_EASING = Easing.bezier(0.2, 0, 0, 1);
const STRETCH_DOWN_DURATION = 320;
const STRETCH_DOWN_EASING = Easing.bezier(0.34, 1.4, 0.64, 1);

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const routes = state.routes.filter(
    (route) => !['_sitemap', '+not-found'].includes(route.name),
  );

  const tabWidth =
    (screenWidth - TAB_BAR_OUTER_PADDING * 2 - INNER_PADDING * 2) /
    Math.max(routes.length, 1);

  // Selected index as a shared value so the indicator can animate independently
  // of React renders.
  const indexShared = useSharedValue(state.index);
  useEffect(() => {
    indexShared.value = state.index;
  }, [state.index, indexShared]);

  // The "+" FAB used to live here; it's now rendered by `<WonderSheet>`
  // at the root so it can sit visually on top of the Skia blob. The
  // tab-bar just keeps the regular tabs.

  // Sit close to the bottom edge but leave just enough room so the glass
  // bar floats above the home indicator without bleeding into it. Devices
  // without an indicator (older iPhones / Android with gesture nav off)
  // get a fixed comfortable gap.
  const paddingBottom = tabBarPaddingBottom(bottomInset);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outerContainer, { paddingBottom }]}
    >
      <GlassView
        effect="regular"
        interactive
        style={styles.bar}
        backgroundColor="rgba(255, 255, 255, 0.08)"
      >
        <Indicator indexShared={indexShared} tabWidth={tabWidth} />

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const Icon = icons[route.name as keyof typeof icons];
          if (!Icon) return null;

          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              // Cast: react-navigation types navigate as a generic union that
              // doesn't unify cleanly with our route names. Using the route
              // name string at runtime is the supported pattern.
              (navigation.navigate as (name: string) => void)(route.name);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => undefined,
              );
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <TabBarButton isFocused={isFocused} Icon={Icon} />
            </Pressable>
          );
        })}
      </GlassView>

      {/* Both the create FAB *and* the sheet itself live in
          `<WonderSheet>` (mounted by `<WonderSheetHost>` at the root)
          so the FAB sits visually on top of the Skia blob — otherwise
          the white blob would cover the purple button. */}
    </View>
  );
}

function Indicator({
  indexShared,
  tabWidth,
}: {
  indexShared: SharedValue<number>;
  tabWidth: number;
}) {
  const translateX = useSharedValue(indexShared.value * tabWidth);
  const scaleX = useSharedValue(1);
  const direction = useSharedValue(1);

  // Re-sync (without animating) only when tabWidth changes — rotation or
  // dynamic route count. Do NOT depend on the active index here: that would
  // snap the pill on every tab tap, stealing the animation that the
  // useAnimatedReaction below is responsible for.
  useEffect(() => {
    translateX.value = Math.round(indexShared.value) * tabWidth;
  }, [tabWidth, indexShared, translateX]);

  useAnimatedReaction(
    () => Math.round(indexShared.value),
    (current, previous) => {
      if (previous === null || current === previous) return;
      direction.value = current > previous ? 1 : -1;

      translateX.value = withTiming(current * tabWidth, {
        duration: SLIDE_DURATION,
        easing: SLIDE_EASING,
      });

      scaleX.value = withSequence(
        withTiming(STRETCH_SCALE, {
          duration: STRETCH_UP_DURATION,
          easing: STRETCH_UP_EASING,
        }),
        withTiming(1, {
          duration: STRETCH_DOWN_DURATION,
          easing: STRETCH_DOWN_EASING,
        }),
      );
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    // Anchor the stretch to the trailing edge so the pill seems to chase
    // the destination rather than expand around its centre.
    const scaleOffset = (-direction.value * tabWidth * (scaleX.value - 1)) / 2;
    return {
      width: tabWidth,
      transform: [
        { translateX: translateX.value + scaleOffset },
        { scaleX: scaleX.value },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.indicator, animatedStyle]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TAB_BAR_OUTER_PADDING,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: INNER_PADDING,
    borderRadius: PILL_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  indicator: {
    position: 'absolute',
    top: INNER_PADDING,
    bottom: INNER_PADDING,
    left: 0,
    borderRadius: PILL_RADIUS,
    // Tailwind purple-500 (168, 85, 247) translucent so it tints rather than
    // covers the glass underneath; brighter purple-400-ish border to crisp
    // the pill edge against the bar.
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(192, 132, 252, 0.7)',
  },
});
