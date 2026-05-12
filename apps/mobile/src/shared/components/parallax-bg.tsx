import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPEED = 1.2;

// Layer movement multipliers (higher = more movement, closer to camera)
// Layer 6 (background) moves least, Layer 1 (foreground) moves most
const LAYER_DEPTHS = {
  layer6: 0.03 * SPEED, // Furthest back
  layer5: 0.05 * SPEED, // Sun - moves slowly
  layer4: 0.08 * SPEED,
  layer3: 0.12 * SPEED,
  layer2: 0.16 * SPEED,
  layer1: 0.2 * SPEED, // Closest/foreground
};

// How much larger images should be to prevent white borders (as percentage)
const IMAGE_SCALE = 1;

export const ParallaxBg = ({ className }: { className?: string }) => {
  const sunFloat = useSharedValue(0);
  const scrollX = useSharedValue(0);

  // Create animated styles for each layer with scale to prevent white borders
  const scaledWidth = SCREEN_WIDTH * IMAGE_SCALE;
  const scaledHeight = SCREEN_HEIGHT * IMAGE_SCALE;
  const offsetX = (scaledWidth - SCREEN_WIDTH) / 2;
  const offsetY = (scaledHeight - SCREEN_HEIGHT) / 2;

  const layer6Style = useAnimatedStyle(() => ({
    width: scaledWidth,
    height: scaledHeight,
    position: 'absolute',
    top: -offsetY,
    left: -offsetX,
    transform: [{ translateX: scrollX.value * LAYER_DEPTHS.layer6 }],
  }));

  const layer5Style = useAnimatedStyle(() => ({
    width: scaledWidth,
    height: scaledHeight,
    position: 'absolute',
    top: -200 - offsetY,
    left: -offsetX,
    transform: [
      // { translateX: scrollX.value * LAYER_DEPTHS.layer5 },
      { translateY: sunFloat.value }, // Only sun's vertical animation
    ],
  }));

  const layer4Style = useAnimatedStyle(() => ({
    width: scaledWidth,
    height: scaledHeight,
    position: 'absolute',
    top: -40 - offsetY,
    left: -offsetX,
    transform: [{ translateX: scrollX.value * LAYER_DEPTHS.layer4 }],
  }));

  const layer3Style = useAnimatedStyle(() => ({
    width: scaledWidth,
    height: scaledHeight,
    position: 'absolute',
    top: -offsetY,
    left: -offsetX,
    transform: [{ translateX: scrollX.value * LAYER_DEPTHS.layer3 }],
  }));

  const layer2Style = useAnimatedStyle(() => ({
    width: scaledWidth,
    height: scaledHeight,
    position: 'absolute',
    top: -offsetY,
    left: -offsetX,
    transform: [{ translateX: scrollX.value * LAYER_DEPTHS.layer2 }],
  }));

  const layer1Style = useAnimatedStyle(() => ({
    width: scaledHeight,
    height: scaledHeight,
    position: 'absolute',
    top: -offsetY,
    left: -offsetX,
    transform: [{ translateX: scrollX.value * LAYER_DEPTHS.layer1 }],
  }));

  // Start sun floating animation on mount
  useEffect(() => {
    sunFloat.value = withRepeat(
      withTiming(55, {
        duration: 8000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Infinite loop
      true, // Reverse (go up then down)
    );
  }, []);

  // Start horizontal scrolling animation (right to left)
  useEffect(() => {
    // Scroll from right (positive) to left (negative)
    // The animation will loop infinitely
    scrollX.value = withRepeat(
      withSequence(
        withTiming(-300, {
          duration: 20000, // 60 seconds for a slow, smooth scroll
          easing: Easing.linear,
        }),
        withTiming(0, {
          duration: 20000, // 60 seconds for a slow, smooth scroll
          easing: Easing.linear,
        }),
      ),
      -1, // Infinite loop
      false, // Don't reverse, just reset to start
    );
  }, []);

  return (
    <View
      className={className}
      style={{
        height: '100%',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden', // Prevent white borders from showing
      }}
    >
      <Animated.View style={layer6Style}>
        <Image
          key="bg-parallax-6"
          style={{
            width: 800,
            left: -200,
            height: '100%',
            top: -200,
            // position: 'absolute',
          }}
          source={require('@/assets/images/parallax/layer6.png')}
          contentFit="none"
        />
      </Animated.View>
      <Animated.View style={layer5Style}>
        <Image
          key="bg-parallax-5"
          style={{
            width: '200%',
            height: '100%',
            left: -200,
            // position: 'absolute',
            transform: [{ scale: 0.5 }],
          }}
          source={require('@/assets/images/parallax/layer5.png')}
          // contentFit="cover"
          contentFit="none"
        />
      </Animated.View>
      <Animated.View style={layer4Style}>
        <Image
          key="bg-parallax-4"
          style={{
            width: 800,
            left: -200,
            top: -100,
            height: '100%',
            // position: 'absolute',
          }}
          source={require('@/assets/images/parallax/layer4.png')}
          contentFit="none"
        />
      </Animated.View>

      <Animated.View style={layer3Style}>
        <Image
          key="bg-parallax-3"
          style={{
            width: 800,
            left: -200,
            height: '100%',
            top: -50,
            // position: 'absolute',
          }}
          source={require('@/assets/images/parallax/layer3.png')}
          contentFit="none"
        />
      </Animated.View>
      <Animated.View style={layer2Style}>
        <Image
          key="bg-parallax-2"
          style={{
            width: 800,
            left: -100,
            height: '100%',
            top: -130,
            // position: 'absolute',
          }}
          source={require('@/assets/images/parallax/layer2.png')}
          contentFit="none"
        />
      </Animated.View>
      <Animated.View style={layer1Style}>
        <Image
          key="bg-parallax-1"
          style={{
            width: 600,
            left: -100,
            height: '100%',
            top: -120,
            // position: 'absolute',
          }}
          source={require('@/assets/images/parallax/layer1.png')}
          contentFit="none"
        />
      </Animated.View>
      <View className="absolute left-0 right-0 h-[200px] bottom-0 bg-[#1B1B3C]" />
      <LottieView
        loop={true}
        autoPlay={true}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: -10,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
        }}
        speed={0.2}
        source={require('@/assets/animations/flock.json')}
      />
    </View>
  );
};
