import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, View } from 'react-native';
import {
  AnswerButtons,
  GameScreenLayout,
  getStreakLevel,
  triggerGameHaptics,
  useGameContext,
  useGameExitPrompt,
  useNoteAnimations,
} from '~/features/game';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { MusicStaff } from '~/shared/components/music-staff';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { Note } from '~/shared/types/music';
import {
  convertDisplayNamesToNotes,
  generateRandomNote,
} from '~/shared/utils/music-utils';

const COUNTDOWN_SECONDS = 3;
const NOTE_COUNT = 20;
const LINE_SPEED = 5000;
const STAFF_WIDTH = 350;
const STAFF_HEIGHT = 180;
const STAFF_SPACING = 24;
const NOTES_PER_STAFF = 10;

interface NoteStatus {
  note: Note;
  hit: boolean;
  missed: boolean;
  answered: boolean;
}

const NOTE_WINDOW = STAFF_WIDTH / NOTES_PER_STAFF;

export default function RhythmGame() {
  const { gameLogic, gameSettings } = useGameContext();
  const { animatedNotes, setNotesStatic, highlightNoteAtIndex } =
    useNoteAnimations();

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [noteStatuses, setNoteStatuses] = useState<NoteStatus[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);

  const linePosition = useRef(new Animated.Value(0)).current;
  const lineListenerId = useRef<string | null>(null);
  const lineAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const linePositionValue = useRef(0);
  const noteStatusesRef = useRef<NoteStatus[]>([]);
  const highlightedIndexRef = useRef<number>(-1);

  const gameOverRef = useRef(false);
  const textColor = useThemeColor({}, 'text');

  const noteObjects = useMemo(() => animatedNotes, [animatedNotes]);

  const staffGroups = useMemo(() => {
    const grouped: Note[][] = [];
    for (let index = 0; index < noteObjects.length; index += NOTES_PER_STAFF) {
      grouped.push(noteObjects.slice(index, index + NOTES_PER_STAFF));
    }
    return grouped;
  }, [noteObjects]);

  const totalStaffHeight =
    staffGroups.length * STAFF_HEIGHT +
    Math.max(0, staffGroups.length - 1) * STAFF_SPACING;

  const stopLineAnimation = () => {
    if (lineAnimationRef.current) {
      lineAnimationRef.current.stop();
      lineAnimationRef.current = null;
    }
    if (lineListenerId.current) {
      linePosition.removeListener(lineListenerId.current);
      lineListenerId.current = null;
    }
  };

  const updateCurrentNoteIndex = (next: number) => {
    setCurrentNoteIndex(next);
  };

  const findNextPendingIndex = (start: number, statuses: NoteStatus[]) => {
    for (let idx = start; idx < statuses.length; idx += 1) {
      if (!statuses[idx].answered) {
        return idx;
      }
    }
    return -1;
  };

  const setHighlightedIndex = (index: number) => {
    if (index < 0 || index === highlightedIndexRef.current) {
      return;
    }
    highlightedIndexRef.current = index;
    highlightNoteAtIndex(index);
  };

  const highlightNextPending = (start: number, statuses: NoteStatus[]) => {
    const nextPending = findNextPendingIndex(start, statuses);
    if (nextPending !== -1) {
      setHighlightedIndex(nextPending);
      updateCurrentNoteIndex(nextPending);
    } else {
      updateCurrentNoteIndex(Math.min(statuses.length, start));
    }
  };

  const markNoteAs = (
    index: number,
    mutate: (note: NoteStatus) => NoteStatus,
  ) => {
    let updatedStatuses: NoteStatus[] | null = null;
    setNoteStatuses((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = mutate(updated[index]);
      }
      updatedStatuses = updated;
      return updated;
    });

    if (!updatedStatuses) {
      return;
    }

    const statusesArray: NoteStatus[] = updatedStatuses;
    const allAnswered = statusesArray.every((status) => status.answered);
    if (allAnswered) {
      setTimeout(() => {
        setShowResults(true);
      }, 400);
    }

    highlightNextPending(index + 1, statusesArray);
  };

  const generateRhythmNotes = () => {
    const statuses: NoteStatus[] = [];
    const totalNotes = Math.max(
      NOTES_PER_STAFF,
      Math.ceil(NOTE_COUNT / NOTES_PER_STAFF) * NOTES_PER_STAFF,
    );

    for (let index = 0; index < totalNotes; index += 1) {
      statuses.push({
        note: generateRandomNote(gameSettings.gameSettings.difficulty),
        hit: false,
        missed: false,
        answered: false,
      });
    }

    setNoteStatuses(statuses);
    setNotesStatic(statuses.map((status) => status.note));
    setActiveStaff(0);
    updateCurrentNoteIndex(0);
    highlightedIndexRef.current = -1;
    linePosition.setValue(0);
    setShowResults(false);
    setGameOver(false);
    setGameStarted(false);
    setCountdown(COUNTDOWN_SECONDS);
    gameOverRef.current = false;

    gameLogic.generateNewQuestion(gameSettings.gameSettings);
  };

  const checkForMissedNotes = (staffIndex: number, linePos: number) => {
    if (gameOverRef.current || gameOver) return;
    const statuses = noteStatusesRef.current;
    const startIndex = staffIndex * NOTES_PER_STAFF;
    const staffNoteCount = Math.min(
      NOTES_PER_STAFF,
      statuses.length - startIndex,
    );
    if (staffNoteCount <= 0) {
      return;
    }

    const expectedLocal = Math.min(
      Math.floor(linePos / NOTE_WINDOW),
      staffNoteCount,
    );
    const expectedGlobal = startIndex + expectedLocal;

    for (let index = currentNoteIndex; index < expectedGlobal; index += 1) {
      const status = statuses[index];
      if (status && !status.answered) {
        markNoteAs(index, (note) => ({
          ...note,
          missed: true,
          answered: true,
        }));
      }
    }
  };

  const startStaffAnimation = (staffIndex: number) => {
    if (staffIndex >= staffGroups.length) {
      setTimeout(() => setShowResults(true), 400);
      return;
    }

    stopLineAnimation();

    setActiveStaff(staffIndex);
    linePosition.setValue(0);
    linePositionValue.current = 0;
    highlightedIndexRef.current = -1;
    highlightNextPending(staffIndex * NOTES_PER_STAFF, noteStatusesRef.current);

    lineListenerId.current = linePosition.addListener(({ value }) => {
      linePositionValue.current = value;
      checkForMissedNotes(staffIndex, value);

      const statuses = noteStatusesRef.current;
      const startIndex = staffIndex * NOTES_PER_STAFF;
      const staffNoteCount = Math.min(
        NOTES_PER_STAFF,
        statuses.length - startIndex,
      );

      if (staffNoteCount > 0) {
        const localIndex = Math.min(
          Math.max(Math.floor(value / NOTE_WINDOW), 0),
          staffNoteCount - 1,
        );

        let absoluteIndex = startIndex + localIndex;
        while (
          absoluteIndex < startIndex + staffNoteCount &&
          statuses[absoluteIndex]?.answered
        ) {
          absoluteIndex += 1;
        }

        if (absoluteIndex < startIndex + staffNoteCount) {
          setHighlightedIndex(absoluteIndex);
        }
      }
    });

    lineAnimationRef.current = Animated.timing(linePosition, {
      toValue: STAFF_WIDTH,
      duration: LINE_SPEED,
      useNativeDriver: false,
    });

    lineAnimationRef.current.start(({ finished }) => {
      if (!finished) return;

      // Ensure any remaining notes on this staff are processed
      checkForMissedNotes(staffIndex, STAFF_WIDTH + NOTE_WINDOW);

      if (staffIndex + 1 < staffGroups.length) {
        startStaffAnimation(staffIndex + 1);
      } else if (!showResults) {
        setTimeout(() => {
          setShowResults(true);
        }, 400);
      }
    });
  };

  const startLineAnimation = () => {
    setGameStarted(true);
    startStaffAnimation(0);
  };

  const handleCorrectAnswer = (index: number) => {
    markNoteAs(index, (note) => ({
      ...note,
      hit: true,
      answered: true,
    }));
    triggerGameHaptics(true);
    gameLogic.submitAnswer([noteStatusesRef.current[index].note.name]);
  };

  const handleWrongAnswer = (index: number) => {
    markNoteAs(index, (note) => ({
      ...note,
      missed: true,
      answered: true,
    }));
    triggerGameHaptics(false);
  };

  const handleAnswerSubmit = (answer: string) => {
    if (gameOver || !gameStarted || showResults) return;

    const staffIndex = activeStaff;
    const currentPos = linePositionValue.current;
    const noteWidth = NOTE_WINDOW;
    const localIndex = Math.round(currentPos / noteWidth);

    const noteCenter = localIndex * noteWidth + noteWidth / 2;
    const distance = Math.abs(currentPos - noteCenter);
    if (distance > noteWidth / 2) {
      return;
    }

    const globalIndex = Math.min(
      staffIndex * NOTES_PER_STAFF + localIndex,
      noteStatusesRef.current.length - 1,
    );
    const noteStatus = noteStatusesRef.current[globalIndex];
    if (!noteStatus || noteStatus.answered) {
      return;
    }

    const normalizedAnswer = convertDisplayNamesToNotes(
      [answer],
      gameSettings.gameSettings.notationSystem,
    )[0];

    if (normalizedAnswer === noteStatus.note.name) {
      handleCorrectAnswer(globalIndex);
    } else {
      handleWrongAnswer(globalIndex);
    }
  };

  const handleMissedNote = (index: number) => {
    markNoteAs(index, (note) => ({
      ...note,
      missed: true,
      answered: true,
    }));
    triggerGameHaptics(false);
  };

  const handleGameEnd = useGameExitPrompt(gameLogic, gameSettings, {
    onExit: () => {
      stopLineAnimation();
      router.back();
    },
  });

  const handleExitGame = async () => {
    stopLineAnimation();
    await gameLogic.endGame(gameSettings.gameSettings);
    router.back();
  };

  const answeredCount = noteStatuses.filter((status) => status.answered).length;
  const hitCount = noteStatuses.filter((status) => status.hit).length;

  useEffect(() => {
    noteStatusesRef.current = noteStatuses;
  }, [noteStatuses]);

  useEffect(() => {
    if (!gameLogic.gameState.isGameActive) {
      gameLogic.startGame(gameSettings.gameSettings);
    }
  }, [gameLogic, gameSettings]);

  useEffect(() => {
    if (gameLogic.gameState.isGameActive && noteStatuses.length === 0) {
      generateRhythmNotes();
    }
  }, [gameLogic.gameState.isGameActive, noteStatuses.length]);

  useEffect(() => {
    if (countdown > 0 && noteStatuses.length > 0 && !gameStarted) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0 && !gameStarted && noteStatuses.length > 0) {
      startLineAnimation();
    }
  }, [countdown, gameStarted, noteStatuses.length]);

  useEffect(() => {
    return () => {
      gameOverRef.current = true;
      stopLineAnimation();
    };
  }, []);

  const exitPrompt = useGameExitPrompt(gameLogic, gameSettings, {
    onExit: () => {
      stopLineAnimation();
      router.back();
    },
  });

  const handleEndGamePressed = () => {
    exitPrompt();
  };

  return (
    <GameScreenLayout
      isGameActive={gameLogic.gameState.isGameActive}
      onEndGame={handleEndGamePressed}
      gradientColors={['#FF6B6B', '#FF8E53']}
      scoreboard={{
        score: gameLogic.gameState.score,
        streak: gameLogic.gameState.streak,
        maxStreak: gameLogic.gameState.maxStreak,
        totalQuestions: noteStatuses.length,
        correctAnswers: hitCount,
        animateStreak: false,
      }}
    >
      <View className="flex-1">
        <View className="px-6 py-4">
          {!gameStarted ? (
            <View className="items-center">
              <ThemedText
                className="text-4xl font-bold mb-2"
                style={{ color: textColor }}
              >
                {countdown}
              </ThemedText>
              <ThemedText
                className="text-xl font-bold text-center"
                style={{ color: textColor }}
              >
                Get Ready!
              </ThemedText>
              <ThemedText
                className="text-sm text-center opacity-70 mt-2"
                style={{ color: textColor }}
              >
                Tap the matching note when the red line crosses it.
              </ThemedText>
            </View>
          ) : showResults ? (
            <View className="items-center">
              <ThemedText
                className="text-2xl font-bold text-center mb-3"
                style={{ color: textColor }}
              >
                🎵 Results 🎵
              </ThemedText>
              <View className="flex-row gap-6">
                <View className="items-center">
                  <ThemedText className="text-3xl font-bold text-green-400">
                    {hitCount}
                  </ThemedText>
                  <ThemedText
                    className="text-sm opacity-70"
                    style={{ color: textColor }}
                  >
                    Correct
                  </ThemedText>
                </View>
                <View className="items-center">
                  <ThemedText className="text-3xl font-bold text-red-400">
                    {noteStatuses.filter((status) => status.missed).length}
                  </ThemedText>
                  <ThemedText
                    className="text-sm opacity-70"
                    style={{ color: textColor }}
                  >
                    Missed
                  </ThemedText>
                </View>
                <View className="items-center">
                  <ThemedText
                    className="text-3xl font-bold"
                    style={{ color: textColor }}
                  >
                    {gameLogic.gameState.score}
                  </ThemedText>
                  <ThemedText
                    className="text-sm opacity-70"
                    style={{ color: textColor }}
                  >
                    Score
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : (
            <View className="items-center">
              <ThemedText
                className="text-xl font-bold text-center"
                style={{ color: textColor }}
              >
                Hit the notes!
              </ThemedText>
              <ThemedText
                className="text-sm text-center opacity-70 mt-1"
                style={{ color: textColor }}
              >
                {hitCount} / {noteStatuses.length} notes hit
              </ThemedText>
            </View>
          )}
        </View>

        <View className="flex-1 items-center px-4">
          <View
            style={{
              position: 'relative',
              width: STAFF_WIDTH,
              height: totalStaffHeight,
            }}
          >
            {staffGroups.map((notes, index) => {
              const startIndex = index * NOTES_PER_STAFF;
              const key =
                notes
                  .map((note) =>
                    note.noteId
                      ? note.noteId
                      : `${note.name}-${note.staffPosition}`,
                  )
                  .join('|') || `staff-${index}`;

              return (
                <View
                  key={key}
                  style={{
                    position: 'absolute',
                    top: index * (STAFF_HEIGHT + STAFF_SPACING),
                    left: 0,
                  }}
                  className={index === activeStaff ? '' : 'opacity-70'}
                >
                  <MusicStaff
                    notes={notes}
                    showFeedback={false}
                    isCorrect={false}
                    showNoteLabels={
                      index === activeStaff &&
                      gameSettings.gameSettings.showNoteLabels
                    }
                    showClef={index === 0}
                    notationSystem={gameSettings.gameSettings.notationSystem}
                    streakLevel={
                      index === activeStaff
                        ? getStreakLevel(gameLogic.gameState.streak)
                        : 0
                    }
                    width={STAFF_WIDTH}
                    height={STAFF_HEIGHT}
                  />
                </View>
              );
            })}

            <Animated.View
              style={{
                position: 'absolute',
                left: linePosition,
                top: activeStaff * (STAFF_HEIGHT + STAFF_SPACING),
                height: STAFF_HEIGHT,
                width: 3,
                backgroundColor: '#FF0000',
                zIndex: 100,
                shadowColor: '#FF0000',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
              }}
            />
          </View>
        </View>

        <View className="pb-8 px-6">
          {!showResults ? (
            <AnswerButtons
              options={gameLogic.gameState.currentQuestion.options}
              onAnswerSubmit={handleAnswerSubmit}
              disabled={gameOver || !gameStarted}
            />
          ) : (
            <FlatButton
              size="xl"
              onPress={handleExitGame}
              className="rounded-xl px-6 py-4 border-green-400 bg-green-800 text-[#ffffff] border-2"
            >
              <FlatButtonText className="text-xl font-bold text-white">
                EXIT & SAVE RESULTS
              </FlatButtonText>
            </FlatButton>
          )}
        </View>
      </View>
    </GameScreenLayout>
  );
}
