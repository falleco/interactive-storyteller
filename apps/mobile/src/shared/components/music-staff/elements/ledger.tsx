import { Line } from 'react-native-svg';

interface LedgetLineProps {
  line: number;
  x: number;
  y: number;
  lineSpacing: number;
  color: string;
  strokeWidth: number;
  baseLineY: number;
}
export const LedgerLines = ({
  line,
  x,
  y,
  lineSpacing,
  color,
  strokeWidth,
  baseLineY,
}: LedgetLineProps) => {
  const lines = [];

  const bottomY = baseLineY + lineSpacing * 4; // Bottom line (E4 line)
  const getNoteY = (staffPosition: number): number => {
    return bottomY - (staffPosition + 1) * (lineSpacing / 2);
  };

  // Determine which ledger lines to draw
  if (line >= 10) {
    // Above staff - draw ledger lines at odd positions (9, 11, 13, 15)
    for (let i = 10; i <= line; i += 2) {
      const lineY = getNoteY(i);
      lines.push(
        <Line
          key={`ledger-top-${i}-${x}-${y}`}
          x1={x - 15}
          y1={lineY + lineSpacing / 2}
          x2={x + 15}
          y2={lineY + lineSpacing / 2}
          stroke={color}
          strokeWidth={strokeWidth}
        />,
      );
    }
  } else if (line <= -2) {
    // Below staff - draw ledger lines at odd positions (-1, -3, -5, -7)
    for (let i = -2; i >= line; i -= 2) {
      const lineY = getNoteY(i);
      lines.push(
        <Line
          key={`ledger-bottom-${i}-${x}-${y}`}
          x1={x - 15}
          y1={lineY + lineSpacing / 2}
          x2={x + 15}
          y2={lineY + lineSpacing / 2}
          stroke={color}
          strokeWidth={strokeWidth}
        />,
      );
    }
  }

  return <>{lines}</>;
};
