import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Dimensions } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { SharedVector } from './utils';
import { WaveSide } from './wave';

const { width } = Dimensions.get('screen');
const RADIUS = 22;

interface PullButtonProps {
  position: SharedVector;
  side: WaveSide;
  activeSide: SharedValue<WaveSide>;
}

/**
 * Visual affordance riding along the wave — a soft chevron the user can
 * pull from. Fades out while a drag is in progress so it doesn't fight
 * the wave for attention.
 */
export function PullButton({ position, side, activeSide }: PullButtonProps) {
  const isLeft = side === WaveSide.LEFT;

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: isLeft ? position.x.value - RADIUS * 2 : width - position.x.value,
    top: position.y.value - RADIUS,
    width: RADIUS * 2,
    height: RADIUS * 2,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    opacity: withTiming(activeSide.value === WaveSide.NONE ? 0.85 : 0),
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <MaterialCommunityIcons
        name={isLeft ? 'chevron-right' : 'chevron-left'}
        size={22}
        color="#ffffff"
      />
    </Animated.View>
  );
}
