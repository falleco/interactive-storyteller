import { useEffect } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import {
  LINE_WIDTH,
  LINES,
  lineSpacing,
  noteSpacing,
  START_X_WITH_CLEF,
  START_X_WITHOUT_CLEF,
} from '~/shared/constants/config';
import { useAnimatedSlideTo } from '~/shared/hooks/animations/use-animated-slide-to';
import type { Note } from '~/shared/types/music';
import { TrebleClef } from '../clefs/tremble';
import { SemibreveNote } from '../notes/semibreve';
import { LedgerLines } from './ledger';

interface PentagramProps {
  clef?: 'treble' | 'bass';
  streakLevel: number;
  width: number;
  height: number;
  className?: string;
  color: string;
  renderExtras?: () => React.ReactNode;
  scale?: number;
  notes: Note[];
  onNoteAnimationComplete?: (noteId?: string) => void;
}

export const Pentagram = ({
  clef,
  streakLevel,
  width,
  height,
  className,
  color,
  renderExtras,
  scale = 1,
  notes = [],
  onNoteAnimationComplete,
}: PentagramProps) => {
  const baseLineY = height / 2 - lineSpacing * 2;

  let clefElement = null;
  if (clef === 'treble') {
    clefElement = (
      <TrebleClef
        color={color}
        streakLevel={streakLevel}
        baseLineY={baseLineY}
        className={`absolute`}
        scale={scale}
      />
    );
  }

  const noteStartX = clef ? START_X_WITH_CLEF : START_X_WITHOUT_CLEF;
  const e4LineY = baseLineY + lineSpacing * 4;

  const getNoteY = (staffPosition: number): number => {
    return e4LineY - (staffPosition + 1) * (lineSpacing / 2);
  };

  const { animationStyle, slideTo } = useAnimatedSlideTo({
    start: width + 100,
    end: 0,
  });

  useEffect(() => {
    slideTo();
  }, [slideTo]);

  return (
    <View className="relative">
      <Svg
        width={width}
        height={height}
        className={className}
        transform={`scale(${scale})`}
      >
        {LINES.map((lineIndex) => (
          <Line
            key={`pentagram-line-${lineIndex}`}
            x1={0}
            y1={baseLineY + lineIndex * lineSpacing}
            x2={width}
            y2={baseLineY + lineIndex * lineSpacing}
            stroke={color}
            strokeWidth={LINE_WIDTH}
          />
        ))}

        {renderExtras?.()}
      </Svg>

      {clefElement}

      <View className="absolute top-0 left-0" style={[{ width, height }]}>
        <Svg width={width} height={height}>
          {notes.map((note, index) => {
            const noteX = noteStartX + index * noteSpacing;
            const noteY = getNoteY(note.staffPosition);

            return (
              <LedgerLines
                key={`ledger-${noteX}-${noteY}`}
                line={note.staffPosition}
                x={noteX}
                y={noteY}
                baseLineY={baseLineY}
                lineSpacing={lineSpacing}
                color={color}
                strokeWidth={2}
              />
            );
          })}
        </Svg>
      </View>

      <Animated.View
        className="absolute top-0 left-0"
        style={[animationStyle, { width, height }]}
      >
        <Svg width={width} height={height}>
          {notes.map((note, index) => {
            const noteX = noteStartX + index * noteSpacing;
            const noteY = getNoteY(note.staffPosition);

            return (
              <SemibreveNote
                key={note.noteId || `note-${noteX}-${noteY}`}
                position={note.staffPosition}
                color={color}
                x={noteX}
                y={noteY}
                scale={0.035}
                state={note.state}
                animation={note.animation}
                noteId={note.noteId}
                onAnimationComplete={onNoteAnimationComplete}
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
};
