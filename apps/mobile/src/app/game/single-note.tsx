import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { MusicStaff } from '~/shared/components/music-staff';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { GameMode } from '~/shared/types/music';
import {
  getNoteDisplayName,
  isAnswerCorrect,
} from '~/shared/utils/music-utils';

interface GameScreenProps {
  onGameEnd?: () => void;
}

export default function SingleNoteGame({ onGameEnd }: GameScreenProps) {
  const {
    animatedNotes,
    setNotesWithCreation,
    triggerDestruction,
    handleNoteAnimationComplete,
    isAnimating,
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

  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (!gameLogic.gameState.isGameActive) {
      gameLogic.startGame(gameSettings.gameSettings);
    }
  }, [gameLogic, gameSettings.gameSettings]);

  const handleAnswerSubmit = (answers: string) => {
    const { normalizedAnswer, correctNotes, isCorrect } =
      evaluateAnswer(answers);
    gameLogic.submitAnswer(normalizedAnswer);
    setShowFeedback(true);

    triggerGameHaptics(isCorrect);

    // Auto-advance timing based on game mode and correctness
    const delay = getAutoAdvanceDelay(
      gameSettings.gameSettings.gameMode,
      isCorrect,
    );

    // Trigger note destruction animation
    triggerDestruction(isCorrect, () => {
      // Animation complete - proceed to next question
      setShowFeedback(false);
      advanceToNextQuestion();
    });

    const timeout = setTimeout(() => {
      // Fallback in case animation doesn't complete
      if (!isAnimating) {
        setShowFeedback(false);
        advanceToNextQuestion();
      }
    }, delay);

    setFeedbackTimeout(timeout);
  };

  const handleNextQuestion = () => {
    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
    }
    setShowFeedback(false);
    advanceToNextQuestion();
  };

  const handleEndGame = useGameExitPrompt(gameLogic, gameSettings, {
    onExit: () => {
      onGameEnd?.();
      router.back();
    },
  });

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

        {/* Answer Options */}
        <View className="pb-8">
          <AnswerButtons
            options={gameLogic.gameState.currentQuestion.options}
            onAnswerSubmit={handleAnswerSubmit}
            disabled={gameLogic.gameState.currentQuestion.answered}
          />
        </View>

        {/* Feedback and Next Button */}
        {false && showFeedback && (
          <View className="items-center mt-5 px-6">
            {/* Show feedback text only for incorrect answers in single-note mode, or always for other modes */}
            {(gameSettings.gameSettings.gameMode !== GameMode.SINGLE_NOTE ||
              !isAnswerCorrect(gameLogic.gameState.currentQuestion)) && (
              <ThemedText
                className="text-xl font-bold mb-2"
                style={{
                  color: isAnswerCorrect(gameLogic.gameState.currentQuestion)
                    ? '#4CAF50'
                    : '#F44336',
                }}
              >
                {isAnswerCorrect(gameLogic.gameState.currentQuestion)
                  ? 'Correct! 🎉'
                  : 'Try again! 💪'}
              </ThemedText>
            )}

            {/* Subtle correct indicator for single-note mode */}
            {gameSettings.gameSettings.gameMode === GameMode.SINGLE_NOTE &&
              isAnswerCorrect(gameLogic.gameState.currentQuestion) && (
                <View className="items-center my-2">
                  <ThemedText
                    className="text-2xl font-bold mb-1"
                    style={{ color: '#4CAF50' }}
                  >
                    ✓
                  </ThemedText>
                  <ThemedText
                    className="text-sm opacity-70 italic"
                    style={{ color: textColor }}
                  >
                    Next question...
                  </ThemedText>
                </View>
              )}

            {!isAnswerCorrect(gameLogic.gameState.currentQuestion) && (
              <ThemedText
                className="text-base mb-4 text-center"
                style={{ color: textColor }}
              >
                Correct answer:{' '}
                {currentQuestion.notes
                  .map((note) =>
                    getNoteDisplayName(
                      note.name,
                      gameSettings.gameSettings.notationSystem,
                    ),
                  )
                  .join(', ')}
              </ThemedText>
            )}

            {/* Show next button only for incorrect answers in single-note mode, or always for other modes */}
            {(gameSettings.gameSettings.gameMode !== GameMode.SINGLE_NOTE ||
              !isAnswerCorrect(gameLogic.gameState.currentQuestion)) && (
              <Button
                action="primary"
                variant="solid"
                size="lg"
                onPress={handleNextQuestion}
                className="rounded-full px-8 py-3"
              >
                <ButtonText className="text-white text-base font-semibold">
                  Next Question
                </ButtonText>
              </Button>
            )}
          </View>
        )}
      </View>
    </GameScreenLayout>
  );
}
