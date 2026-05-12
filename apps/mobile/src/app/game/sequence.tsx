import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  AnswerButtons,
  GameScreenLayout,
  useGameExitPrompt,
  useNoteAnimations,
  useNoteRoundController,
} from '~/features/game';
import {
  getAutoAdvanceDelay,
  getStreakLevel,
  triggerGameHaptics,
} from '~/features/game/utils/game-logic';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { MusicStaff } from '~/shared/components/music-staff';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';
import {
  getNoteDisplayName,
  isAnswerCorrect,
} from '~/shared/utils/music-utils';

export default function SequenceGame() {
  const {
    animatedNotes,
    setNotesWithCreation,
    triggerSequenceNoteFeedback,
    highlightNoteAtIndex,
    handleNoteAnimationComplete,
  } = useNoteAnimations();
  const {
    gameLogic,
    gameSettings,
    currentQuestion,
    advanceToNextQuestion,
    evaluateAnswer,
  } = useNoteRoundController({
    onNotesReady: setNotesWithCreation,
  });

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTimeout, setFeedbackTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [userSequence, setUserSequence] = useState<string[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (!gameLogic.gameState.isGameActive) {
      gameLogic.startGame(gameSettings.gameSettings);
    }
  }, [gameLogic, gameSettings.gameSettings]);

  // Reset sequence when new question
  useEffect(() => {
    setUserSequence([]);
    setCurrentNoteIndex(0);
  }, [currentQuestion.id, currentQuestion.notes]);

  useEffect(() => {
    if (!showFeedback && currentQuestion.notes.length > 0) {
      highlightNoteAtIndex(currentNoteIndex);
    }
  }, [
    currentNoteIndex,
    currentQuestion.notes,
    highlightNoteAtIndex,
    showFeedback,
  ]);

  const handleNoteSelect = (noteName: string) => {
    if (showFeedback) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newSequence = [...userSequence, noteName];
    setUserSequence(newSequence);
    setCurrentNoteIndex(currentNoteIndex + 1);

    // If sequence is complete, submit answer
    if (
      newSequence.length === gameLogic.gameState.currentQuestion.notes.length
    ) {
      handleAnswerSubmit(newSequence);
    }
  };

  const answerSequence = useMemo(() => {
    return Object.assign(
      new Array(gameLogic.gameState.currentQuestion.notes.length).fill(null),
      userSequence,
    );
  }, [gameLogic.gameState.currentQuestion.notes, userSequence]);

  const handleAnswerSubmit = (answers: string[]) => {
    const { normalizedAnswer, correctNotes, isCorrect } =
      evaluateAnswer(answers);
    gameLogic.submitAnswer(normalizedAnswer);
    setShowFeedback(true);

    triggerGameHaptics(isCorrect);

    // Trigger individual note feedback for sequence mode
    triggerSequenceNoteFeedback(normalizedAnswer, correctNotes);

    // Auto-advance timing based on game mode and correctness
    const delay = getAutoAdvanceDelay(
      gameSettings.gameSettings.gameMode,
      isCorrect,
    );

    const timeout = setTimeout(() => {
      setShowFeedback(false);
      advanceToNextQuestion();
    }, delay);

    setFeedbackTimeout(timeout);
  };

  const handleReset = () => {
    if (showFeedback) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUserSequence([]);
    setCurrentNoteIndex(0);
  };

  const exitPrompt = useGameExitPrompt(gameLogic, gameSettings, {
    onExit: () => {
      router.back();
    },
  });

  const handleEndGame = () => {
    exitPrompt();
  };

  return (
    <GameScreenLayout
      isGameActive={gameLogic.gameState.isGameActive}
      onEndGame={handleEndGame}
      scoreboard={{
        score: gameLogic.gameState.score,
        streak: gameLogic.gameState.streak,
        maxStreak: gameLogic.gameState.maxStreak,
        totalQuestions: gameLogic.gameState.totalQuestions,
        correctAnswers: gameLogic.gameState.correctAnswers,
        animateStreak:
          showFeedback && isAnswerCorrect(gameLogic.gameState.currentQuestion),
      }}
    >
      <View className="flex-1">
        {/* Instructions */}
        <View className="px-6 py-4">
          <ThemedText
            className="text-xl font-bold text-center mb-2"
            style={{ color: textColor }}
          >
            Identify the sequence:
          </ThemedText>
          <ThemedText
            className="text-sm text-center opacity-70 mb-2"
            style={{ color: textColor }}
          >
            Select notes from left to right ({userSequence.length}/
            {gameLogic.gameState.currentQuestion.notes.length})
          </ThemedText>

          {/* Progress indicator */}
          <View className="flex-row justify-center items-center gap-2 mt-2">
            {gameLogic.gameState.currentQuestion.notes.map((note, index) => (
              <View
                key={`${note.name}-${index}`}
                className={cn(
                  'w-3 h-3 rounded-full',
                  index < userSequence.length
                    ? 'bg-green-500'
                    : index === userSequence.length
                      ? 'bg-blue-500'
                      : 'bg-gray-300',
                )}
              />
            ))}
          </View>
        </View>

        {/* Music Staff */}
        <View className="flex-1 justify-center items-center px-4">
          <MusicStaff
            notes={animatedNotes}
            showFeedback={showFeedback}
            isCorrect={isAnswerCorrect(gameLogic.gameState.currentQuestion)}
            showNoteLabels={gameSettings.gameSettings.showNoteLabels}
            notationSystem={gameSettings.gameSettings.notationSystem}
            streakLevel={getStreakLevel(gameLogic.gameState.streak)}
            width={350}
            height={180}
            onNoteAnimationComplete={handleNoteAnimationComplete}
          />
        </View>

        {/* Selected sequence display */}
        {answerSequence.length > 0 && (
          <View className="px-6 py-2">
            <ThemedText
              className="text-center text-sm opacity-70 mb-2"
              style={{ color: textColor }}
            >
              Your Answer:
            </ThemedText>
            <View className="flex-row justify-center gap-2">
              {answerSequence.map((note, index) => (
                <View
                  key={`selected-${note}-${Date.now()}-${index}`}
                  className="px-3 py-1 bg-green-100 rounded-lg"
                >
                  <ThemedText
                    className="text-sm font-medium"
                    style={{ color: '#000' }}
                  >
                    {note ?? '?'}
                  </ThemedText>
                </View>
              ))}
              {/* Reset button */}
              {userSequence.length > 0 && !showFeedback && (
                <FlatButton
                  size="xs"
                  onPress={handleReset}
                  className="p-0 m-0 rounded-lg"
                >
                  <Image
                    style={{ width: 16, height: 16 }}
                    source={require('@/assets/images/hud/close.png')}
                  />
                </FlatButton>
              )}
            </View>
          </View>
        )}

        {/* Answer Options */}
        <View className="pb-8">
          <AnswerButtons
            options={gameLogic.gameState.currentQuestion.options}
            onAnswerSubmit={handleNoteSelect}
          />
        </View>
      </View>
    </GameScreenLayout>
  );
}
