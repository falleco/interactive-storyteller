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

const DEFAULT_EXTRA_LETTER_COUNT = 4;
const DEFAULT_ROUND_ID = 'mobile-word-puzzle';
const DEFAULT_TARGET_WORD = 'STAR';
const GAME_NAME = 'word-puzzle';
const LOG_PREFIX = '[WordPuzzle]';

type BridgeResult = {
  configureOk?: boolean;
  error?: string;
  feedbackOk?: boolean;
  hasAppController?: boolean;
  ok: boolean;
  phase: string;
  resetOk?: boolean;
};

type WordPuzzleRouteParams = {
  bookId?: string | string[];
  extraLetterCount?: string | string[];
  pageId?: string | string[];
  roundId?: string | string[];
  targetWord?: string | string[];
  word?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseExtraLetterCount(value: string | string[] | undefined) {
  const raw = firstParam(value);
  if (!raw) return DEFAULT_EXTRA_LETTER_COUNT;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_EXTRA_LETTER_COUNT;

  return Math.max(0, Math.min(10, parsed));
}

async function resetWordPuzzleRound(roundId: string): Promise<boolean> {
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
        ok: Boolean(appController.reset_round(roundId)),
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

async function configureWordPuzzleBridge({
  extraLetterCount,
  onGameCompleted,
  roundId,
  targetWord,
}: {
  extraLetterCount: number;
  onGameCompleted: () => Promise<void>;
  roundId: string;
  targetWord: string;
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
        const configureOk = appController.configure_word(
          targetWord,
          roundId,
          extraLetterCount,
        );

        return {
          configureOk,
          feedbackOk,
          hasAppController,
          ok: feedbackOk && configureOk,
          phase: 'configureBridge',
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

export default function WordPuzzleScreen() {
  const params = useLocalSearchParams<WordPuzzleRouteParams>();
  const bookId = firstParam(params.bookId);
  const pageId = firstParam(params.pageId);
  const { completeGame } = useBooks();
  const [isReady, setIsReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isContinuingStory, setIsContinuingStory] = useState(false);
  const storyCompletionHandledRef = useRef(false);

  const targetWord =
    (
      firstParam(params.targetWord) ||
      firstParam(params.word) ||
      DEFAULT_TARGET_WORD
    )
      .trim()
      .toUpperCase() || DEFAULT_TARGET_WORD;
  const roundId = firstParam(params.roundId)?.trim() || DEFAULT_ROUND_ID;
  const extraLetterCount = parseExtraLetterCount(params.extraLetterCount);
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
    void resetWordPuzzleRound(roundId)
      .then((ok) => {
        if (!ok) {
          setIsComplete(true);
        }
      })
      .catch((error) => {
        console.error(`${LOG_PREFIX} reset rejected`, toLoggableError(error));
        setIsComplete(true);
      });
  }, [roundId]);

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
        return configureWordPuzzleBridge({
          extraLetterCount,
          onGameCompleted: notifyGameCompleted,
          roundId,
          targetWord,
        });
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
  }, [extraLetterCount, notifyGameCompleted, roundId, targetWord]);

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
            <Text style={styles.modalTitle}>Great spelling!</Text>
            <Text style={styles.modalBody}>
              You built the word {targetWord} with every letter in place.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Back to games"
                style={({ pressed }) => [
                  styles.gameButton,
                  styles.secondaryButton,
                  pressed ? styles.gameButtonPressed : null,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={handlePlayAgain}
                accessibilityRole="button"
                accessibilityLabel="Play again"
                style={({ pressed }) => [
                  styles.gameButton,
                  styles.primaryButton,
                  pressed ? styles.gameButtonPressed : null,
                ]}
              >
                <Text style={styles.primaryButtonText}>Play again</Text>
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
    backgroundColor: '#dff5ff',
  },
  gameView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(223, 245, 255, 0.1)',
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
    backgroundColor: '#eff6ff',
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
    backgroundColor: '#2563eb',
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
