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
 * Executa uma ou várias animações.
 * - Se for 1 target: anima sozinho.
 * - Se for vários targets: roda em paralelo e só resolve quando todos acabam.
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
