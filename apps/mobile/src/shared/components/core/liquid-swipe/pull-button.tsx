import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Dimensions } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import type { SharedVector } from './utils';
import { WaveSide } from './wave';

const { width } = Dimensions.get('screen');
const RADIUS = 22;
const EDGE_OUTSET = 8;

interface PullButtonProps {
  position: SharedVector;
  side: WaveSide;
  visibility?: SharedValue<number>;
  /**
   * Signed translation (px) for the chevron — independently driven by
   * the slider so the icon can spring/wobble past its rest position
   * while the wave returns more smoothly.
   */
  iconOffset?: SharedValue<number>;
}

/**
 * Visual affordance riding along the wave — a solid chevron button the
 * user can pull or tap from the exposed page edge.
 */
export function PullButton({
  position,
  side,
  visibility,
  iconOffset,
}: PullButtonProps) {
  const isLeft = side === WaveSide.LEFT;

  const style = useAnimatedStyle(() => {
    const visible = visibility?.value ?? 1;

    return {
      position: 'absolute',
      left: isLeft
        ? position.x.value - RADIUS * 2 - EDGE_OUTSET
        : width - position.x.value + EDGE_OUTSET,
      top: position.y.value - RADIUS,
      width: RADIUS * 2,
      height: RADIUS * 2,
      borderRadius: RADIUS,
      borderWidth: 2,
      borderColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#050505',
      opacity: visible,
      transform: [{ scale: 0.86 + visible * 0.14 }],
    };
  });

  // Chevron rides its own animation: timing-out alongside the wave's
  // outward leg, then a low-damping spring back to zero that overshoots
  // and oscillates — the "mola" effect. `direction` flips the sign so
  // the right-side arrow springs right and the left-side springs left,
  // each toward where it points.
  const iconStyle = useAnimatedStyle(() => {
    const offset = iconOffset?.value ?? 0;
    const direction = isLeft ? -1 : 1;
    return {
      transform: [{ translateX: offset * direction }],
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <Animated.View style={iconStyle}>
        <MaterialCommunityIcons
          name={isLeft ? 'chevron-left' : 'chevron-right'}
          size={22}
          color="#ffffff"
        />
      </Animated.View>
    </Animated.View>
  );
}
