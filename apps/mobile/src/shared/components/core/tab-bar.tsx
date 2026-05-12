import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  type WithTimingConfig,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { animate } from '~/shared/lib/animation';
import { cn } from '~/shared/lib/cn';
import { TabBarButton } from './tab-bar-button';

export interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TabBarButtonBackground = ({
  className,
  style,
}: {
  className?: string;
  style?: ViewStyle;
}) => {
  return (
    <View
      className={cn(
        'flex-1 justify-between items-center absolute bottom-0 left-0 right-0',
        className,
      )}
    >
      <Animated.View
        className={cn(
          'border-[#361848] rounded-full w-40 h-40 -mb-6 border-4 bg-[#160E22]',
        )}
        style={style}
      />
    </View>
  );
};

export const TabBar = ({ state, descriptors, navigation }: TabBarProps) => {
  const primaryColor = '#0891b2';
  const greyColor = '#160E22';
  const { bottom } = useSafeAreaInsets();
  const selectedX = useSharedValue(0);
  const selectedScale = useSharedValue(1);

  const size = 146;
  const moveTo = useCallback(
    async (position: number) => {
      await animate({
        sharedValue: selectedX,
        toValue: position * size - size,
        config: {
          duration: 500,
          easing: Easing.inOut(Easing.back(2)),
        },
      });
    },
    [selectedScale, selectedX],
  );

  const animationStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: selectedScale.value },
        { translateX: selectedX.value },
      ],
    };
  }, []);

  return (
    <View
      className={`absolute bottom-0 flex-row justify-between items-center pt-4 mx-0`}
      style={{ paddingBottom: bottom + 5 }}
    >
      <LinearGradient
        colors={['#1B1B3C', '#1B1B3C00']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 0 }}
        style={{
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <View className="flex-1 flex-row relative">
        <TabBarButtonBackground
          className="flex-1 absolute"
          style={animationStyle}
        />
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          if (['_sitemap', '+not-found'].includes(route.name)) return null;

          const isFocused = state.index === index;

          const onPress = () => {
            moveTo(index);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            }
          };

          const onLongPress = () => {
            const event = navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
            }
          };

          return (
            <TabBarButton
              key={route.name}
              onPress={onPress}
              onLongPress={onLongPress}
              isFocused={isFocused}
              routeName={route.name}
              color={isFocused ? primaryColor : greyColor}
              label={label}
            />
          );
        })}
      </View>
    </View>
  );
};
