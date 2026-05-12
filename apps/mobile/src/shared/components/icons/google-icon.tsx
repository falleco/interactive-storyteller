import Animated from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';
import { type IconProps, resolveColor } from './icon-types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const GoogleIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'white',
  animatedProps,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d="M21.68 12.2292C21.68 11.5142 21.6158 10.8267 21.4967 10.1667H12V14.0717H17.4267C17.1883 15.3275 16.4733 16.3909 15.4008 17.1059V19.645H18.6733C20.58 17.885 21.68 15.3 21.68 12.2292Z"
        fill={resolveColor(color)}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        d="M12 22.0833C14.7225 22.0833 17.005 21.185 18.6733 19.645L15.4008 17.1058C14.5025 17.7108 13.3566 18.0775 12 18.0775C9.37829 18.0775 7.15079 16.3083 6.35329 13.925H2.99829V16.5283C4.65746 19.8192 8.05829 22.0833 12 22.0833Z"
        fill={resolveColor(color)}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        d="M6.35341 13.9158C6.15175 13.3108 6.03258 12.6692 6.03258 12C6.03258 11.3308 6.15175 10.6892 6.35341 10.0842V7.48083H2.99841C2.31091 8.8375 1.91675 10.3683 1.91675 12C1.91675 13.6317 2.31091 15.1625 2.99841 16.5192L5.61091 14.4842L6.35341 13.9158Z"
        fill={resolveColor(color)}
        animatedProps={animatedProps}
      />
      <AnimatedPath
        d="M12 5.93169C13.485 5.93169 14.805 6.44502 15.8591 7.43502L18.7466 4.54752C16.9958 2.91585 14.7225 1.91669 12 1.91669C8.05829 1.91669 4.65746 4.18085 2.99829 7.48085L6.35329 10.0842C7.15079 7.70085 9.37829 5.93169 12 5.93169Z"
        fill={resolveColor(color)}
        animatedProps={animatedProps}
      />
    </Svg>
  );
};
