import {
  type SharedValue,
  type WithTimingConfig,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export type AnimateTarget = {
  sharedValue: SharedValue<number>;
  toValue: number;
  config?: WithTimingConfig;
};

/**
 * Runs one or more animations.
 * - With one target: animates it directly.
 * - With multiple targets: runs them in parallel and resolves after all finish.
 */
export function animate(...targets: AnimateTarget[]): Promise<void> {
  const promises = targets.map(
    ({ sharedValue, toValue, config }) =>
      new Promise<void>((resolve) => {
        sharedValue.value = withTiming(
          toValue,
          config,
          (finished?: boolean) => {
            if (finished) {
              scheduleOnRN(resolve);
            }
          },
        );
      }),
  );

  return Promise.all(promises).then(() => {});
}
