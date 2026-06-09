import Animated from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';
import { type IconProps, resolveColor } from './icon-types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const GamesIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'white',
  animatedProps,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
      <AnimatedPath
        d="M176,56H80A56.06,56.06,0,0,0,24,112v48a40,40,0,0,0,70.59,25.78L112,165.18h32l17.41,20.6A40,40,0,0,0,232,160V112A56.06,56.06,0,0,0,176,56Zm40,104a24,24,0,0,1-42.35,15.46l-19.81-23.43A8,8,0,0,0,147.73,149H108.27a8,8,0,0,0-6.11,3.03L82.35,175.46A24,24,0,0,1,40,160V112A40,40,0,0,1,80,72h96a40,40,0,0,1,40,40ZM104,116a8,8,0,0,1-8,8H84v12a8,8,0,0,1-16,0V124H56a8,8,0,0,1,0-16H68V96a8,8,0,0,1,16,0v12H96A8,8,0,0,1,104,116Zm56-8a12,12,0,1,1,12,12A12,12,0,0,1,160,108Zm40,32a12,12,0,1,1-12-12A12,12,0,0,1,200,140Z"
        fill={resolveColor(color)}
        animatedProps={animatedProps}
      />
    </Svg>
  );
};
