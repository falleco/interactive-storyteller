import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Dimensions } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { SharedVector } from './utils';
import { WaveSide } from './wave';

const { width } = Dimensions.get('screen');
const RADIUS = 22;
const IDLE_COLOR = 'rgba(0, 0, 0, 0.18)';
const HINT_COLOR = 'rgba(147, 51, 234, 0.95)'; // purple-600

interface PullButtonProps {
  position: SharedVector;
  side: WaveSide;
  activeSide: SharedValue<WaveSide>;
  /**
   * 0..1 hint intensity. When > 0 the button tints purple to draw
   * attention. Omit (or hold at 0) for the static idle look.
   */
  hintProgress?: SharedValue<number>;
  /**
   * Signed translation (px) for the chevron — independently driven by
   * the slider so the icon can spring/wobble past its rest position
   * while the wave returns more smoothly.
   */
  iconOffset?: SharedValue<number>;
}

/**
 * Visual affordance riding along the wave — a soft chevron the user can
 * pull from. Fades out while a drag is in progress so it doesn't fight
 * the wave for attention.
 */
export function PullButton({
  position,
  side,
  activeSide,
  hintProgress,
  iconOffset,
}: PullButtonProps) {
  const isLeft = side === WaveSide.LEFT;

  const style = useAnimatedStyle(() => {
    const hintT = hintProgress?.value ?? 0;
    const backgroundColor =
      hintT > 0
        ? interpolateColor(hintT, [0, 1], [IDLE_COLOR, HINT_COLOR])
        : IDLE_COLOR;
    return {
      position: 'absolute',
      left: isLeft ? position.x.value - RADIUS * 2 : width - position.x.value,
      top: position.y.value - RADIUS,
      width: RADIUS * 2,
      height: RADIUS * 2,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor,
      opacity: withTiming(activeSide.value === WaveSide.NONE ? 0.85 : 0),
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
