import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTabBarRouteName, tabBarItems } from '../icons';
import { TabBarButton } from './tab-bar-button';

/**
 * Geometry constants for the fixed bottom tab bar.
 */
export const TAB_BAR_HEIGHT = 82;
const TAB_BAR_OUTER_PADDING = 0;
const INNER_PADDING = 7;
const ACTIVE_RING_SIZE = 92;

/** Matches the runtime formula used in `TabBar` for paddingBottom. */
export function tabBarPaddingBottom(bottomInset: number): number {
  return Math.max(bottomInset, 0);
}

// Slide animation for the active-tab circle.
const SLIDE_SPRING = {
  damping: 14,
  mass: 0.8,
  stiffness: 165,
};
const BUMP_SCALE = 1.08;
const BUMP_UP_DURATION = 120;
const BUMP_UP_EASING = Easing.bezier(0.2, 0, 0, 1);
const BUMP_DOWN_DURATION = 240;
const BUMP_DOWN_EASING = Easing.bezier(0.34, 1.4, 0.64, 1);

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();

  const routes = state.routes.filter(
    (route) =>
      !['_sitemap', '+not-found'].includes(route.name) &&
      isTabBarRouteName(route.name),
  );
  const activeRouteKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(
    routes.findIndex((route) => route.key === activeRouteKey),
    0,
  );

  const tabWidth =
    (screenWidth - TAB_BAR_OUTER_PADDING * 2 - INNER_PADDING * 2) /
    Math.max(routes.length, 1);

  // Selected index as a shared value so the indicator can animate independently
  // of React renders.
  const indexShared = useSharedValue(activeIndex);
  useEffect(() => {
    indexShared.set(activeIndex);
  }, [activeIndex, indexShared]);

  // The nav is fixed to the bottom edge. Safe-area space is inside the bar
  // so the bottom of the screen is always occupied by the navbar itself.
  const bottomPadding = tabBarPaddingBottom(bottomInset);

  return (
    <View pointerEvents="box-none" style={styles.outerContainer}>
      <View
        style={[
          styles.bar,
          {
            height: TAB_BAR_HEIGHT + bottomPadding,
            paddingBottom: INNER_PADDING + bottomPadding,
          },
        ]}
      >
        <Indicator indexShared={indexShared} tabWidth={tabWidth} />

        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const item = tabBarItems[route.name as keyof typeof tabBarItems];

          const isFocused = activeRouteKey === route.key;
          const fallbackLabel =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? item.label);
          const label = options.tabBarAccessibilityLabel ?? fallbackLabel;

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
              hitSlop={6}
            >
              <TabBarButton
                isFocused={isFocused}
                label={item.label}
                source={item.source}
              />
            </Pressable>
          );
        })}
      </View>
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
  const translateX = useSharedValue(0);
  const bumpScale = useSharedValue(1);

  // Re-sync (without animating) only when tabWidth changes — rotation or
  // dynamic route count. Do NOT depend on the active index here: that would
  // snap the pill on every tab tap, stealing the animation that the
  // useAnimatedReaction below is responsible for.
  useEffect(() => {
    translateX.set(Math.round(indexShared.get()) * tabWidth);
  }, [tabWidth, indexShared, translateX]);

  useAnimatedReaction(
    () => Math.round(indexShared.get()),
    (current, previous) => {
      if (previous === null || current === previous) return;

      translateX.set(withSpring(current * tabWidth, SLIDE_SPRING));

      bumpScale.set(
        withSequence(
          withTiming(BUMP_SCALE, {
            duration: BUMP_UP_DURATION,
            easing: BUMP_UP_EASING,
          }),
          withTiming(1, {
            duration: BUMP_DOWN_DURATION,
            easing: BUMP_DOWN_EASING,
          }),
        ),
      );
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: ACTIVE_RING_SIZE,
      height: ACTIVE_RING_SIZE,
      borderRadius: ACTIVE_RING_SIZE / 2,
      transform: [
        {
          translateX:
            translateX.get() + Math.max((tabWidth - ACTIVE_RING_SIZE) / 2, 0),
        },
        { scale: bumpScale.get() },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: INNER_PADDING,
    paddingHorizontal: INNER_PADDING,
    overflow: 'visible',
    backgroundColor: 'rgba(7, 5, 15, 0.96)',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.82)',
    elevation: 0,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    overflow: 'visible',
  },
  indicator: {
    position: 'absolute',
    // The active ring intentionally rises above the nav bar so the selected
    // sticker feels pinned on top of the dock.
    top: -18,
    left: INNER_PADDING,
    backgroundColor: 'rgba(7, 5, 15, 0.98)',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#FF5DA2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
});
