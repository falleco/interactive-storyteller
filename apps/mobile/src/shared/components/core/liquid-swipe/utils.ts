import { type SharedValue, useSharedValue } from 'react-native-reanimated';

/**
 * Tiny worklet that picks the snap point closest to `value + 0.2 * velocity`.
 * Inlined from `react-native-redash` to avoid the extra dep — the rest of
 * its API we don't need.
 */
export function snapPoint(
  value: number,
  velocity: number,
  points: number[],
): number {
  'worklet';
  const point = value + 0.2 * velocity;
  const deltas = points.map((p) => Math.abs(point - p));
  const minDelta = Math.min(...deltas);
  const index = deltas.indexOf(minDelta);
  return points[index] ?? value;
}

export interface SharedVector {
  x: SharedValue<number>;
  y: SharedValue<number>;
}

/** `{ x: useSharedValue(x), y: useSharedValue(y) }` shorthand. */
export function useVector(x = 0, y = 0): SharedVector {
  return {
    x: useSharedValue(x),
    y: useSharedValue(y),
  };
}
