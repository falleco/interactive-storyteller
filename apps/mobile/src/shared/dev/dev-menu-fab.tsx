import { router } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { QaToolIcon } from '~/shared/components/icons/qa-tool-icon';
import { ThemedText } from '~/shared/components/themed-text';

const FAB_SIZE = 44;
const EDGE_PADDING = 8;
const SNAP_DAMPING = 20;
const Z_INDEX = 9999;

export function DevMenuFab() {
  if (!__DEV__) return null;
  return <DevMenuFabInner />;
}

function DevMenuFabInner() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const translateX = useSharedValue(screenWidth - FAB_SIZE - EDGE_PADDING);
  const translateY = useSharedValue(screenHeight * 0.5);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const open = () => router.push('/dev-menu');

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
      scale.value = withSpring(1.15, { damping: SNAP_DAMPING });
    })
    .onUpdate((event) => {
      translateX.value = Math.max(
        EDGE_PADDING,
        Math.min(
          offsetX.value + event.translationX,
          screenWidth - FAB_SIZE - EDGE_PADDING,
        ),
      );
      translateY.value = Math.max(
        EDGE_PADDING,
        Math.min(
          offsetY.value + event.translationY,
          screenHeight - FAB_SIZE - EDGE_PADDING,
        ),
      );
    })
    .onEnd(() => {
      isDragging.value = false;
      scale.value = withSpring(1, { damping: SNAP_DAMPING });

      const snapToLeft = translateX.value < screenWidth / 2;
      translateX.value = withSpring(
        snapToLeft ? EDGE_PADDING : screenWidth - FAB_SIZE - EDGE_PADDING,
        { damping: SNAP_DAMPING },
      );
    });

  const tapGesture = Gesture.Tap().onEnd((_event, success) => {
    if (success && !isDragging.value) {
      runOnJS(open)();
    }
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: isDragging.value ? 1 : 0.7,
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: '#111',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: Z_INDEX,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6,
          },
          animatedStyle,
        ]}
      >
        <ThemedText style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
          <QaToolIcon size={24} color="N5" />
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}
