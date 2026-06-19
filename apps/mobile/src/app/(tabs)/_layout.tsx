import { Tabs } from 'expo-router';
import { useCallback } from 'react';
import {
  type Animated,
  type StyleProp,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { TabBar } from '~/shared/components/core/tab-bar';

type TabSceneStyleInterpolator = (props: {
  current: { progress: Animated.Value };
}) => { sceneStyle: Animated.WithAnimatedValue<StyleProp<ViewStyle>> };

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const sceneSlideDistance = Math.max(width, 1);
  const slideSceneStyleInterpolator = useCallback<TabSceneStyleInterpolator>(
    ({ current }) => ({
      sceneStyle: {
        opacity: 1,
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-sceneSlideDistance, 0, sceneSlideDistance],
            }),
          },
        ],
      },
    }),
    [sceneSlideDistance],
  );

  return (
    <Tabs
      // Stories stays the default route even though it is visually centered.
      initialRouteName="index"
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        sceneStyleInterpolator: slideSceneStyleInterpolator,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: false,
        transitionSpec: {
          animation: 'spring',
          config: {
            damping: 24,
            mass: 0.9,
            stiffness: 190,
          },
        },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="games"
        options={{
          title: 'Games',
          tabBarAccessibilityLabel: 'Games',
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stories',
          tabBarAccessibilityLabel: 'Stories',
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarAccessibilityLabel: 'Family',
        }}
      />
    </Tabs>
  );
}
