import { useEffect } from 'react';
import Animated from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { useAnimatedSlideTo } from '~/shared/hooks/animations/use-animated-slide-to';

interface NoteGroupProps {
  notes: React.ReactNode[];
  width: number;
  height: number;
}

export const NoteGroup = ({ notes, width, height }: NoteGroupProps) => {
  const { animationStyle, slideTo } = useAnimatedSlideTo({
    start: width + 100,
    end: 0,
  });

  useEffect(() => {
    slideTo();
  }, [slideTo]);

  return (
    <Animated.View
      className="absolute top-0 left-0"
      style={[animationStyle, { width, height }]}
    >
      <Svg width={width} height={height}>
        {notes}
      </Svg>
    </Animated.View>
  );
};
