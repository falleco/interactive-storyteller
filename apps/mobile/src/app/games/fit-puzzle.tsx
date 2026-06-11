import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@borndotcom/react-native-godot';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Worklets } from 'react-native-worklets-core';
import { useBooks } from '~/features/books';
import {
  destroyGodotGame,
  GameBackButton,
  initGodotGame,
  toLoggableError,
  wait,
} from '~/features/games/godot';

const GAME_NAME = 'fit-puzzle';
const LOG_PREFIX = '[FitPuzzle]';
const ROUND_ID = 'mobile-fit-puzzle';

type BridgeResult = {
  error?: string;
  feedbackOk?: boolean;
  hasAppController?: boolean;
  ok: boolean;
  phase: string;
  resetOk?: boolean;
};

async function resetFitPuzzleRound(): Promise<boolean> {
  const result = (await runOnGodotThread(() => {
    'worklet';

    try {
      const Godot = RTNGodot.API();
      const sceneTree = Godot.Engine.get_main_loop();
      const root = sceneTree.get_root();
      const appController =
        root.get_node_or_null('AppController') ??
        root.get_node_or_null('/root/AppController');

      if (appController == null) {
        return {
          ok: false,
          phase: 'resetRound',
        };
      }

      return {
        ok: Boolean(appController.reset_round(ROUND_ID)),
        phase: 'resetRound',
      };
    } catch (error) {
      return {
        error: String(error),
        ok: false,
        phase: 'resetRound',
      };
    }
  })) as BridgeResult;

  console.log(`${LOG_PREFIX} reset round result`, result);
  return result.ok;
}

async function configureFitPuzzleBridge(
  onGameCompleted: () => Promise<void>,
): Promise<boolean> {
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
            console.log(`${LOG_PREFIX} game_event: ${eventName}`);

            if (eventName === 'game_completed') {
              void onGameCompleted();
            }
          });
        } catch (error) {
          console.warn(
            `${LOG_PREFIX} game_event connect skipped`,
            String(error),
          );
        }

        const feedbackOk = appController.set_feedback_enabled(true, true);
        const resetOk = appController.reset_round(ROUND_ID);

        return {
          feedbackOk,
          hasAppController,
          ok: feedbackOk && resetOk,
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

    console.log(`${LOG_PREFIX} bridge configure result`, { attempt, result });

    if (result.ok) {
      return true;
    }

    await wait(250);
  }

  return false;
}

export default function FitPuzzleScreen() {
  const { bookId, pageId } = useLocalSearchParams<{
    bookId?: string;
    pageId?: string;
  }>();
  const { completeGame } = useBooks();
  const [isReady, setIsReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isContinuingStory, setIsContinuingStory] = useState(false);
  const storyCompletionHandledRef = useRef(false);
  const isStoryGame = Boolean(bookId && pageId);

  const handleGameCompleted = useCallback(() => {
    setIsComplete(true);
  }, []);
  const notifyGameCompleted = useMemo(
    () => Worklets.createRunOnJS(handleGameCompleted),
    [handleGameCompleted],
  );

  const handlePlayAgain = useCallback(() => {
    setIsComplete(false);
    void resetFitPuzzleRound()
      .then((ok) => {
        if (!ok) {
          setIsComplete(true);
        }
      })
      .catch((error) => {
        console.error(`${LOG_PREFIX} reset rejected`, toLoggableError(error));
        setIsComplete(true);
      });
  }, []);

  const handleContinueStory = useCallback(async () => {
    if (isContinuingStory || storyCompletionHandledRef.current) return;
    storyCompletionHandledRef.current = true;
    if (!bookId || !pageId) {
      router.back();
      return;
    }
    setIsContinuingStory(true);
    try {
      await completeGame({ bookId, pageId, gameId: GAME_NAME });
      router.back();
    } catch (error) {
      storyCompletionHandledRef.current = false;
      console.warn(`${LOG_PREFIX} complete story game failed`, error);
    } finally {
      setIsContinuingStory(false);
    }
  }, [bookId, completeGame, isContinuingStory, pageId]);

  useEffect(() => {
    if (!isStoryGame || !isComplete || isContinuingStory) return;
    void handleContinueStory();
  }, [handleContinueStory, isComplete, isContinuingStory, isStoryGame]);

  useEffect(() => {
    let mounted = true;

    setIsComplete(false);
    setIsReady(false);
    void initGodotGame({ gameName: GAME_NAME, logPrefix: LOG_PREFIX })
      .then(async (ready) => {
        if (!ready) {
          return false;
        }
        return configureFitPuzzleBridge(notifyGameCompleted);
      })
      .then((ready) => {
        if (mounted) {
          setIsReady(Boolean(ready));
        }
      })
      .catch((error) => {
        console.error(`${LOG_PREFIX} init rejected`, toLoggableError(error));
        if (mounted) {
          setIsReady(false);
        }
      });

    return () => {
      mounted = false;
      destroyGodotGame(LOG_PREFIX);
    };
  }, [notifyGameCompleted]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <RTNGodotView style={styles.gameView} />
      <GameBackButton />
      {!isReady ? (
        <View pointerEvents="none" style={styles.loadingOverlay} />
      ) : null}
      <Modal
        animationType="fade"
        transparent
        visible={isComplete && !isStoryGame}
        onRequestClose={() => router.back()}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.completionCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Great job!</Text>
            <Text style={styles.modalBody}>
              {isStoryGame
                ? 'You matched every shape and helped the story move forward.'
                : 'You matched every shape in the puzzle.'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={
                  isStoryGame ? handleContinueStory : () => router.back()
                }
                accessibilityRole="button"
                accessibilityLabel={
                  isStoryGame ? 'Continue story' : 'Back to games'
                }
                disabled={isContinuingStory}
                style={({ pressed }) => [
                  styles.gameButton,
                  isStoryGame ? styles.primaryButton : styles.secondaryButton,
                  pressed ? styles.gameButtonPressed : null,
                ]}
              >
                <Text
                  style={
                    isStoryGame
                      ? styles.primaryButtonText
                      : styles.secondaryButtonText
                  }
                >
                  {isContinuingStory
                    ? 'Saving...'
                    : isStoryGame
                      ? 'Continue'
                      : 'Back'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handlePlayAgain}
                accessibilityRole="button"
                accessibilityLabel="Play again"
                disabled={isContinuingStory}
                style={({ pressed }) => [
                  styles.gameButton,
                  isStoryGame ? styles.secondaryButton : styles.primaryButton,
                  pressed ? styles.gameButtonPressed : null,
                ]}
              >
                <Text
                  style={
                    isStoryGame
                      ? styles.secondaryButtonText
                      : styles.primaryButtonText
                  }
                >
                  Play again
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf0e4',
  },
  gameView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(253, 240, 228, 0.08)',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  completionCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    backgroundColor: '#fff7ed',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  badge: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#16a34a',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  modalTitle: {
    marginTop: 16,
    color: '#111827',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalBody: {
    marginTop: 8,
    color: '#4b5563',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  modalActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  gameButton: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 3,
    shadowColor: '#111827',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  primaryButton: {
    borderColor: '#111827',
    backgroundColor: '#f59e0b',
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  secondaryButton: {
    borderColor: '#111827',
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  gameButtonPressed: {
    shadowOffset: { width: 0, height: 2 },
    transform: [{ translateY: 3 }, { scale: 0.99 }],
  },
});
