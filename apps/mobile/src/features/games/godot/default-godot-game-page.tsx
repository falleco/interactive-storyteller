import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@borndotcom/react-native-godot';
import type { StoryGameDescriptor } from '@wondertales/shared/games';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Worklets } from 'react-native-worklets-core';
import { ThemedText } from '~/shared/components/themed-text';
import {
  destroyGodotGame,
  initGodotGame,
  toLoggableError,
  wait,
} from './godot-runtime';

export type DefaultGodotGameEventType =
  | 'complete'
  | 'configuration'
  | 'error'
  | 'event'
  | 'ready'
  | 'reset'
  | 'success'
  | 'touch';

export type DefaultGodotGameEvent = {
  gameId: string;
  name: string;
  type: DefaultGodotGameEventType;
};

type BridgeResult = {
  configureOk?: boolean;
  error?: string;
  feedbackOk?: boolean;
  hasAppController?: boolean;
  ok: boolean;
  phase: string;
  resetOk?: boolean;
};

type DefaultGodotGamePageProps = {
  descriptor: StoryGameDescriptor;
  hapticsEnabled?: boolean;
  logPrefix?: string;
  onComplete?: () => Promise<void> | void;
  onEvent?: (event: DefaultGodotGameEvent) => void;
  soundEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

type GodotHostConfig = {
  colorHexes: string[];
  configJson: string;
  extraLetterCount: number;
  gameId: string;
  gameType: string;
  patternIds: string[];
  roundId: string;
  targetWord: string;
};

const DEFAULT_EXTRA_LETTER_COUNT = 4;
const DEFAULT_TARGET_WORD = 'STAR';

export function DefaultGodotGamePage({
  descriptor,
  hapticsEnabled = true,
  logPrefix = `[StoryGame:${descriptor.id}]`,
  onComplete,
  onEvent,
  soundEnabled = true,
  style,
}: DefaultGodotGamePageProps) {
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const completionHandledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onEventRef = useRef(onEvent);
  const configKey = useMemo(
    () => JSON.stringify(descriptor.config ?? {}),
    [descriptor.config],
  );
  const hostConfig = useMemo(
    () => buildGodotHostConfig(descriptor, configKey),
    [configKey, descriptor.id, descriptor.type],
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onEventRef.current = onEvent;
  }, [onComplete, onEvent]);

  const handleGameEvent = useCallback(
    (eventName: string) => {
      const normalized = normalizeGodotGameEvent(descriptor.id, eventName);
      onEventRef.current?.(normalized);

      if (normalized.type !== 'complete' || completionHandledRef.current) {
        return;
      }

      completionHandledRef.current = true;
      void Promise.resolve(onCompleteRef.current?.()).catch((error) => {
        completionHandledRef.current = false;
        console.warn(`${logPrefix} complete callback failed`, error);
      });
    },
    [descriptor.id, logPrefix],
  );

  const notifyGameEvent = useMemo(
    () => Worklets.createRunOnJS(handleGameEvent),
    [handleGameEvent],
  );

  useEffect(() => {
    let mounted = true;
    completionHandledRef.current = false;
    setIsReady(false);
    setErrorMessage(null);

    void initGodotGame({ gameName: descriptor.id, logPrefix })
      .then(async (ready) => {
        if (!ready) return false;
        return configureDefaultGodotBridge({
          hapticsEnabled,
          hostConfig,
          logPrefix,
          onGameEvent: notifyGameEvent,
          soundEnabled,
        });
      })
      .then((ready) => {
        if (!mounted) return;
        setIsReady(Boolean(ready));
        if (!ready) {
          setErrorMessage('The game could not start.');
        }
      })
      .catch((error) => {
        console.error(`${logPrefix} init rejected`, toLoggableError(error));
        if (!mounted) return;
        setIsReady(false);
        setErrorMessage('The game could not start.');
      });

    return () => {
      mounted = false;
      destroyGodotGame(logPrefix);
    };
  }, [
    descriptor.id,
    hapticsEnabled,
    hostConfig,
    logPrefix,
    notifyGameEvent,
    soundEnabled,
  ]);

  return (
    <View style={[styles.container, style]}>
      <RTNGodotView style={styles.gameView} />
      {!isReady && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color="#ffffff" />
          <ThemedText className="text-base font-black text-white mt-3">
            Loading game...
          </ThemedText>
        </View>
      )}
      {errorMessage && (
        <View pointerEvents="none" style={styles.errorOverlay}>
          <ThemedText className="text-xl font-black text-white text-center">
            {errorMessage}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function buildGodotHostConfig(
  descriptor: StoryGameDescriptor,
  configJson: string,
): GodotHostConfig {
  const config = descriptor.config ?? {};
  const roundId =
    typeof config.roundId === 'string' && config.roundId.trim()
      ? config.roundId.trim()
      : `${descriptor.id}-story-round`;
  const targetWord =
    typeof config.targetWord === 'string' && config.targetWord.trim()
      ? config.targetWord.trim().toUpperCase()
      : DEFAULT_TARGET_WORD;
  const extraLetterCount =
    typeof config.extraLetterCount === 'number' &&
    Number.isFinite(config.extraLetterCount)
      ? Math.max(0, Math.min(10, Math.trunc(config.extraLetterCount)))
      : DEFAULT_EXTRA_LETTER_COUNT;

  return {
    colorHexes: toStringList(config.colorHexes),
    configJson,
    extraLetterCount,
    gameId: descriptor.id,
    gameType: descriptor.type,
    patternIds: toStringList(config.patternIds),
    roundId,
    targetWord,
  };
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGodotGameEvent(
  gameId: string,
  name: string,
): DefaultGodotGameEvent {
  if (name === 'game_completed') {
    return { gameId, name, type: 'complete' };
  }
  if (name.endsWith('_rejected') || name.includes('error')) {
    return { gameId, name, type: 'error' };
  }
  if (
    name.endsWith('_placed') ||
    name.endsWith('_painted') ||
    name === 'nail_painted'
  ) {
    return { gameId, name, type: 'success' };
  }
  if (
    name.endsWith('_drag_started') ||
    name === 'paint_started' ||
    name === 'color_selected' ||
    name === 'pattern_selected'
  ) {
    return { gameId, name, type: 'touch' };
  }
  if (name.endsWith('_configured')) {
    return { gameId, name, type: 'configuration' };
  }
  if (name === 'round_reset') {
    return { gameId, name, type: 'reset' };
  }
  if (name === 'round_started') {
    return { gameId, name, type: 'ready' };
  }
  return { gameId, name, type: 'event' };
}

async function configureDefaultGodotBridge({
  hapticsEnabled,
  hostConfig,
  logPrefix,
  onGameEvent,
  soundEnabled,
}: {
  hapticsEnabled: boolean;
  hostConfig: GodotHostConfig;
  logPrefix: string;
  onGameEvent: (eventName: string) => Promise<void>;
  soundEnabled: boolean;
}): Promise<boolean> {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const result = (await runOnGodotThread(() => {
      'worklet';

      try {
        const Godot = RTNGodot.API();
        const sceneTree = Godot.Engine.get_main_loop();
        const root = sceneTree.get_root();
        const appController =
          root.get_node_or_null('AppController') ??
          root.get_node_or_null('/root/AppController');
        const hasAppController = appController != null;

        if (!hasAppController) {
          return {
            hasAppController,
            ok: false,
            phase: 'findAppController',
          };
        }

        try {
          appController.game_event.connect((eventName: string) => {
            void onGameEvent(String(eventName));
          });
        } catch (error) {
          console.warn(
            `${logPrefix} game_event connect skipped`,
            String(error),
          );
        }

        const hasMethod = (methodName: string): boolean => {
          try {
            return Boolean(appController.has_method(methodName));
          } catch (_error) {
            return false;
          }
        };

        const feedbackOk = hasMethod('set_feedback_enabled')
          ? appController.set_feedback_enabled(soundEnabled, hapticsEnabled)
          : true;

        let configureOk = true;
        let resetOk = true;

        if (hasMethod('configure_game')) {
          configureOk = appController.configure_game(
            hostConfig.gameId,
            hostConfig.roundId,
            hostConfig.configJson,
          );
        } else if (
          hostConfig.gameType === 'godot-word-puzzle' &&
          hasMethod('configure_word')
        ) {
          configureOk = appController.configure_word(
            hostConfig.targetWord,
            hostConfig.roundId,
            hostConfig.extraLetterCount,
          );
        } else if (
          hostConfig.gameType === 'godot-nail-paint' &&
          hasMethod('configure_palette')
        ) {
          configureOk = appController.configure_palette(
            hostConfig.roundId,
            hostConfig.colorHexes,
            hostConfig.patternIds,
          );
        } else if (hasMethod('reset_round')) {
          resetOk = appController.reset_round(hostConfig.roundId);
        }

        return {
          configureOk,
          feedbackOk,
          hasAppController,
          ok: feedbackOk && configureOk && resetOk,
          phase: 'configureBridge',
          resetOk,
        };
      } catch (error) {
        return {
          error: String(error),
          ok: false,
          phase: 'configureBridge',
        };
      }
    })) as BridgeResult;

    if (__DEV__) {
      console.log(`${logPrefix} default bridge configure result`, {
        attempt,
        result,
      });
    }

    if (result.ok) {
      return true;
    }

    await wait(250);
  }

  return false;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  gameView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
});
