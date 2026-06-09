import type {
  GameCompletionResult,
  HiddenObjectGameConfig,
  HiddenObjectSceneItem,
  StoryGameDescriptor,
} from '@wondertales/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  createHiddenObjectsState,
  getHiddenObjectsProgress,
  isHiddenObjectFound,
  markHiddenObjectFound,
} from './logic';

type HiddenObjectsGameProps = {
  descriptor: StoryGameDescriptor<HiddenObjectGameConfig>;
  onComplete?: (result: GameCompletionResult) => void;
};

type LayoutSize = {
  width: number;
  height: number;
};

type CoverRect = LayoutSize & {
  left: number;
  top: number;
};

const SKY_IMAGE = require('../../../../assets/games/hidden-objects/sky.png');
const DISTANT_IMAGE = require('../../../../assets/games/hidden-objects/distant.png');
const MIDGROUND_IMAGE = require('../../../../assets/games/hidden-objects/midground.png');
const FOREGROUND_IMAGE = require('../../../../assets/games/hidden-objects/foreground.png');
const SCENE_ASPECT_RATIO = 941 / 1672;

const ITEM_ASSETS: Record<
  string,
  { hidden: ImageSourcePropType; found: ImageSourcePropType }
> = {
  butterfly: {
    hidden: require('../../../../assets/games/hidden-objects/items/butterfly-hidden.png'),
    found: require('../../../../assets/games/hidden-objects/items/butterfly.png'),
  },
  key: {
    hidden: require('../../../../assets/games/hidden-objects/items/key-hidden.png'),
    found: require('../../../../assets/games/hidden-objects/items/key.png'),
  },
  moon: {
    hidden: require('../../../../assets/games/hidden-objects/items/moon-hidden.png'),
    found: require('../../../../assets/games/hidden-objects/items/moon.png'),
  },
  mushroom: {
    hidden: require('../../../../assets/games/hidden-objects/items/mushroom-hidden.png'),
    found: require('../../../../assets/games/hidden-objects/items/mushroom.png'),
  },
  star: {
    hidden: require('../../../../assets/games/hidden-objects/items/star-hidden.png'),
    found: require('../../../../assets/games/hidden-objects/items/star.png'),
  },
};

export function HiddenObjectsGame({
  descriptor,
  onComplete,
}: HiddenObjectsGameProps) {
  const [layout, setLayout] = useState<LayoutSize | null>(null);
  const [state, setState] = useState(createHiddenObjectsState);
  const [lastFoundId, setLastFoundId] = useState<string | null>(null);
  const drift = useSharedValue(-1);

  const config = descriptor.config;
  const progress = getHiddenObjectsProgress(config, state);
  const coverRect = useMemo(
    () => (layout ? getCoverRect(layout, SCENE_ASPECT_RATIO) : null),
    [layout],
  );

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, {
        duration: 6200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [drift]);

  const skyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * -3 },
      { translateY: drift.value * -1 },
      { scale: 1.015 },
    ],
  }));

  const distantStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * -7 },
      { translateY: drift.value * -3 },
      { scale: 1.025 },
    ],
  }));

  const midgroundStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 10 },
      { translateY: drift.value * 4 },
      { scale: 1.04 },
    ],
  }));

  const itemsStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 13 },
      { translateY: drift.value * 5 },
      { scale: 1.045 },
    ],
  }));

  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 20 },
      { translateY: drift.value * 8 },
      { scale: 1.085 },
    ],
  }));

  const handleFind = (itemId: string) => {
    if (isHiddenObjectFound(state, itemId)) return;

    const next = markHiddenObjectFound(config, state, itemId);
    const nextProgress = getHiddenObjectsProgress(config, next);

    setState(next);
    setLastFoundId(itemId);

    Haptics.notificationAsync(
      nextProgress.completed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);

    if (nextProgress.completed) {
      onComplete?.(nextProgress);
    }
  };

  return (
    <View
      style={styles.root}
      onLayout={({ nativeEvent }) => {
        setLayout({
          width: nativeEvent.layout.width,
          height: nativeEvent.layout.height,
        });
      }}
    >
      {coverRect ? (
        <>
          <ParallaxImage
            source={SKY_IMAGE}
            coverRect={coverRect}
            style={skyStyle}
          />
          <ParallaxImage
            source={DISTANT_IMAGE}
            coverRect={coverRect}
            style={distantStyle}
            pointerEvents="none"
          />
          <ParallaxImage
            source={MIDGROUND_IMAGE}
            coverRect={coverRect}
            style={midgroundStyle}
            pointerEvents="none"
          />

          <Animated.View style={[styles.layer, coverRect, itemsStyle]}>
            {config.items.map((item) => (
              <HiddenObjectHotspot
                key={item.id}
                item={item}
                coverRect={coverRect}
                found={isHiddenObjectFound(state, item.id)}
                celebrated={lastFoundId === item.id}
                onFind={() => handleFind(item.id)}
              />
            ))}
          </Animated.View>

          <ParallaxImage
            source={FOREGROUND_IMAGE}
            coverRect={coverRect}
            style={foregroundStyle}
            pointerEvents="none"
          />
        </>
      ) : null}

      {progress.completed ? <CompletionGlow /> : null}
    </View>
  );
}

function ParallaxImage({
  source,
  coverRect,
  style,
  pointerEvents,
}: {
  source: ImageSourcePropType;
  coverRect: CoverRect;
  style: any;
  pointerEvents?: 'none';
}) {
  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={[styles.layer, coverRect, style]}
    >
      <Image source={source} style={styles.fill} contentFit="cover" />
    </Animated.View>
  );
}

function HiddenObjectHotspot({
  item,
  coverRect,
  found,
  celebrated,
  onFind,
}: {
  item: HiddenObjectSceneItem;
  coverRect: CoverRect;
  found: boolean;
  celebrated: boolean;
  onFind: () => void;
}) {
  const scale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const asset = ITEM_ASSETS[item.id];

  useEffect(() => {
    if (found) {
      ringOpacity.value = withTiming(0.76, { duration: 180 });
      scale.value = withSpring(1.08, { damping: 9, stiffness: 130 });
      return;
    }

    if (!celebrated) return;

    ringOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withSequence(
      withTiming(1.25, { duration: 140 }),
      withSpring(1, { damping: 8, stiffness: 150 }),
    );
  }, [celebrated, found, ringOpacity, scale]);

  const spriteStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  const hitSize = item.hitSize;
  const visualSize = item.visualSize;
  const left = (item.x / 100) * coverRect.width - hitSize / 2;
  const top = (item.y / 100) * coverRect.height - hitSize / 2;

  return (
    <View
      style={[
        styles.hotspot,
        {
          left,
          top,
          width: hitSize,
          height: hitSize,
        },
      ]}
    >
      {asset ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.itemSprite,
            {
              width: visualSize,
              height: visualSize,
              left: (hitSize - visualSize) / 2,
              top: (hitSize - visualSize) / 2,
            },
            spriteStyle,
          ]}
        >
          <Image
            source={found ? asset.found : asset.hidden}
            style={styles.fill}
            contentFit="contain"
          />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.foundRing,
          {
            borderColor: item.tint,
            shadowColor: item.tint,
          },
          ringStyle,
        ]}
      />
      <Pressable
        onPress={onFind}
        disabled={found}
        accessibilityRole="button"
        accessibilityLabel={`Find ${item.label}`}
        style={styles.pressTarget}
      />
    </View>
  );
}

function CompletionGlow() {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0.55, { duration: 220 }),
      withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withTiming(1.4, {
      duration: 1120,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.winGlow, style]} />;
}

function getCoverRect(layout: LayoutSize, imageAspectRatio: number): CoverRect {
  const layoutAspectRatio = layout.width / layout.height;

  if (layoutAspectRatio > imageAspectRatio) {
    const width = layout.width;
    const height = width / imageAspectRatio;
    return {
      width,
      height,
      left: 0,
      top: (layout.height - height) / 2,
    };
  }

  const height = layout.height;
  const width = height * imageAspectRatio;
  return {
    width,
    height,
    left: (layout.width - width) / 2,
    top: 0,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#08091c',
  },
  layer: {
    position: 'absolute',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSprite: {
    position: 'absolute',
  },
  pressTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
  },
  foundRing: {
    position: 'absolute',
    top: -8,
    right: -8,
    bottom: -8,
    left: -8,
    borderWidth: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  winGlow: {
    position: 'absolute',
    left: '20%',
    top: '28%',
    width: '60%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
});
