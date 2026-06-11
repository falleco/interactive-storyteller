import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@borndotcom/react-native-godot';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  destroyGodotGame,
  GameBackButton,
  initGodotGame,
  toLoggableError,
} from '~/features/games/godot';

const ACTION_JUMP = 'ui_accept';
const ACTION_MOVE_LEFT = 'ui_left';
const ACTION_MOVE_RIGHT = 'ui_right';
const GAME_NAME = 'demo';
const LOG_PREFIX = '[GodotDemo]';
const CONTROL_BUTTON_SIZE = 70;
const JUMP_BUTTON_SIZE = 80;
const CONTROL_LEFT = 30;
const CONTROL_RIGHT = 30;
const CONTROL_BOTTOM = 40;
const CONTROL_GAP = 20;
let godotControlsReady = false;

type GameAction =
  | typeof ACTION_JUMP
  | typeof ACTION_MOVE_LEFT
  | typeof ACTION_MOVE_RIGHT;

type ControlHitbox = {
  action: GameAction;
  height: number;
  width: number;
  x: number;
  y: number;
};

function findActionAt(hitboxes: ControlHitbox[], x: number, y: number) {
  return (
    hitboxes.find(
      (hitbox) =>
        x >= hitbox.x &&
        x <= hitbox.x + hitbox.width &&
        y >= hitbox.y &&
        y <= hitbox.y + hitbox.height,
    )?.action ?? null
  );
}

function pressAction(action: string) {
  if (!godotControlsReady) {
    console.warn(`${LOG_PREFIX} ignoring press before Godot API is ready`, {
      action,
    });
    return;
  }

  void runOnGodotThread(() => {
    'worklet';
    try {
      const Godot = RTNGodot.API();
      const Input = Godot.Input;
      Input.action_press(action);
    } catch (error) {
      console.error(`${LOG_PREFIX} error pressing action`, {
        action,
        message: String(error),
      });
    }
  }).catch((error: unknown) => {
    console.error(`${LOG_PREFIX} press worklet rejected`, {
      action,
      error: toLoggableError(error),
    });
  });
}

function releaseAction(action: string) {
  if (!godotControlsReady) {
    console.warn(`${LOG_PREFIX} ignoring release before Godot API is ready`, {
      action,
    });
    return;
  }

  void runOnGodotThread(() => {
    'worklet';
    try {
      const Godot = RTNGodot.API();
      const Input = Godot.Input;
      Input.action_release(action);
    } catch (error) {
      console.error(`${LOG_PREFIX} error releasing action`, {
        action,
        message: String(error),
      });
    }
  }).catch((error: unknown) => {
    console.error(`${LOG_PREFIX} release worklet rejected`, {
      action,
      error: toLoggableError(error),
    });
  });
}

export default function GodotDemoScreen() {
  const [isPaused, setIsPaused] = useState(false);
  const [isGodotReady, setIsGodotReady] = useState(godotControlsReady);
  const { height, width } = useWindowDimensions();
  const activeTouchActionsRef = useRef(new Map<string, GameAction>());
  const actionTouchCountsRef = useRef(new Map<GameAction, number>());

  const controlHitboxes = useMemo<ControlHitbox[]>(
    () => [
      {
        action: ACTION_MOVE_LEFT,
        height: CONTROL_BUTTON_SIZE,
        width: CONTROL_BUTTON_SIZE,
        x: CONTROL_LEFT,
        y: height - CONTROL_BOTTOM - CONTROL_BUTTON_SIZE,
      },
      {
        action: ACTION_MOVE_RIGHT,
        height: CONTROL_BUTTON_SIZE,
        width: CONTROL_BUTTON_SIZE,
        x: CONTROL_LEFT + CONTROL_BUTTON_SIZE + CONTROL_GAP,
        y: height - CONTROL_BOTTOM - CONTROL_BUTTON_SIZE,
      },
      {
        action: ACTION_JUMP,
        height: JUMP_BUTTON_SIZE,
        width: JUMP_BUTTON_SIZE,
        x: width - CONTROL_RIGHT - JUMP_BUTTON_SIZE,
        y: height - CONTROL_BOTTOM - JUMP_BUTTON_SIZE,
      },
    ],
    [height, width],
  );

  const pressGameAction = useCallback((action: GameAction) => {
    const count = actionTouchCountsRef.current.get(action) ?? 0;
    actionTouchCountsRef.current.set(action, count + 1);

    if (count === 0) {
      pressAction(action);
    }
  }, []);

  const releaseGameAction = useCallback((action: GameAction) => {
    const count = actionTouchCountsRef.current.get(action) ?? 0;
    const nextCount = count - 1;

    if (nextCount <= 0) {
      actionTouchCountsRef.current.delete(action);
      releaseAction(action);
      return;
    }

    actionTouchCountsRef.current.set(action, nextCount);
  }, []);

  const releaseAllGameActions = useCallback(() => {
    for (const action of actionTouchCountsRef.current.keys()) {
      releaseAction(action);
    }

    activeTouchActionsRef.current.clear();
    actionTouchCountsRef.current.clear();
  }, []);

  const updateTouchAction = useCallback(
    (touchId: string, x: number, y: number) => {
      const nextAction = findActionAt(controlHitboxes, x, y);
      const previousAction = activeTouchActionsRef.current.get(touchId) ?? null;

      if (previousAction === nextAction) {
        return;
      }

      if (previousAction != null) {
        releaseGameAction(previousAction);
        activeTouchActionsRef.current.delete(touchId);
      }

      if (nextAction != null) {
        activeTouchActionsRef.current.set(touchId, nextAction);
        pressGameAction(nextAction);
      }
    },
    [controlHitboxes, pressGameAction, releaseGameAction],
  );

  const handleControlsTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!isGodotReady) {
        return;
      }

      for (const touch of event.nativeEvent.changedTouches) {
        updateTouchAction(touch.identifier, touch.locationX, touch.locationY);
      }
    },
    [isGodotReady, updateTouchAction],
  );

  const handleControlsTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isGodotReady) {
        return;
      }

      for (const touch of event.nativeEvent.changedTouches) {
        updateTouchAction(touch.identifier, touch.locationX, touch.locationY);
      }
    },
    [isGodotReady, updateTouchAction],
  );

  const handleControlsTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      for (const touch of event.nativeEvent.changedTouches) {
        const action = activeTouchActionsRef.current.get(touch.identifier);

        if (action == null) {
          continue;
        }

        activeTouchActionsRef.current.delete(touch.identifier);
        releaseGameAction(action);
      }
    },
    [releaseGameAction],
  );

  useEffect(() => {
    let mounted = true;

    godotControlsReady = false;
    setIsGodotReady(false);

    void initGodotGame({ gameName: GAME_NAME, logPrefix: LOG_PREFIX })
      .then((ready) => {
        godotControlsReady = ready;
        if (mounted) {
          setIsGodotReady(ready);
        }
      })
      .catch((error) => {
        godotControlsReady = false;
        console.error(`${LOG_PREFIX} init rejected`, toLoggableError(error));
        if (mounted) {
          setIsGodotReady(false);
        }
      });

    return () => {
      mounted = false;
      releaseAllGameActions();
      destroyGodotGame(LOG_PREFIX);
    };
  }, [releaseAllGameActions]);

  const handlePlayPause = () => {
    if (isPaused) {
      RTNGodot.resume();
      setIsPaused(false);
    } else {
      RTNGodot.pause();
      setIsPaused(true);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <RTNGodotView style={styles.gameView} />
      <GameBackButton />

      <View
        style={styles.controlsTouchLayer}
        onTouchCancel={handleControlsTouchEnd}
        onTouchEnd={handleControlsTouchEnd}
        onTouchMove={handleControlsTouchMove}
        onTouchStart={handleControlsTouchStart}
      >
        <View pointerEvents="none" style={styles.leftControls}>
          <View
            style={[
              styles.button,
              !isGodotReady ? styles.buttonDisabled : null,
            ]}
          >
            <Ionicons name="chevron-back" size={32} color="white" />
          </View>
          <View
            style={[
              styles.button,
              !isGodotReady ? styles.buttonDisabled : null,
            ]}
          >
            <Ionicons name="chevron-forward" size={32} color="white" />
          </View>
        </View>

        <View pointerEvents="none" style={styles.rightControls}>
          <View
            style={[
              styles.button,
              styles.jumpButton,
              !isGodotReady ? styles.buttonDisabled : null,
            ]}
          >
            <Ionicons name="arrow-up" size={36} color="white" />
          </View>
        </View>
      </View>

      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={handlePlayPause}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={28}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gameView: {
    flex: 1,
  },
  controlsTouchLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 40,
    right: 30,
    zIndex: 2,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  leftControls: {
    position: 'absolute',
    bottom: 40,
    left: 30,
    flexDirection: 'row',
    gap: 20,
  },
  rightControls: {
    position: 'absolute',
    bottom: 40,
    right: 30,
  },
  button: {
    width: CONTROL_BUTTON_SIZE,
    height: CONTROL_BUTTON_SIZE,
    borderRadius: CONTROL_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  jumpButton: {
    width: JUMP_BUTTON_SIZE,
    height: JUMP_BUTTON_SIZE,
    borderRadius: JUMP_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(220, 38, 38, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
});
