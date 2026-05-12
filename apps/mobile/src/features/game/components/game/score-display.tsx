import React from 'react';
import { Animated, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { calculateAccuracy } from '~/shared/utils/music-utils';

export interface ScoreDisplayProps {
  score: number;
  streak: number;
  maxStreak: number;
  totalQuestions: number;
  correctAnswers: number;
  showDetailed?: boolean;
  animateStreak?: boolean;
}

export function ScoreDisplay({
  score,
  streak,
  maxStreak,
  totalQuestions,
  correctAnswers,
  showDetailed = false,
  animateStreak = false,
}: ScoreDisplayProps) {
  const [streakAnimation] = React.useState(new Animated.Value(1));

  React.useEffect(() => {
    if (animateStreak && streak > 0) {
      Animated.sequence([
        Animated.timing(streakAnimation, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(streakAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [streak, animateStreak, streakAnimation]);

  const accuracy = calculateAccuracy(correctAnswers, totalQuestions);

  const getStreakEmoji = () => {
    if (streak >= 10) return '🔥';
    if (streak >= 5) return '⭐';
    if (streak >= 3) return '✨';
    return null;
  };

  if (showDetailed) {
    return (
      <View className="bg-black/30 backdrop-blur-sm rounded-2xl p-5 shadow-2xl mx-4 mb-4 border border-white/10">
        <View className="flex-row justify-between items-center mb-4">
          <View className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-3">
            <ThemedText className="text-2xl font-black text-white font-pixelpurl-medium">
              {score}
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText className="text-lg font-bold text-white font-pixelpurl-medium">
              {accuracy.toFixed(1)}% ACCURACY
            </ThemedText>
            <ThemedText className="text-sm text-white/70 font-semibold font-pixelpurl-medium">
              {correctAnswers}/{totalQuestions} correct
            </ThemedText>
          </View>
        </View>

        <View className="flex-row justify-between items-center">
          <Animated.View
            className="flex-row items-center bg-white/10 rounded-xl p-2"
            style={{ transform: [{ scale: streakAnimation }] }}
          >
            <ThemedText className="text-lg font-bold text-white font-pixelpurl-medium">
              {getStreakEmoji()} STREAK: {streak}
            </ThemedText>
          </Animated.View>

          <View className="bg-white/10 rounded-xl p-2">
            <ThemedText className="text-sm font-semibold text-white/80 font-pixelpurl-medium">
              BEST: {maxStreak}
            </ThemedText>
          </View>
        </View>

        {streak >= 3 && (
          <View className="mt-3 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
            <ThemedText className="text-sm text-center font-bold text-white font-pixelpurl-medium">
              {streak >= 10
                ? '🔥 ON FIRE! 🔥'
                : streak >= 5
                  ? '⭐ HOT STREAK! ⭐'
                  : '✨ GREAT STREAK! ✨'}
            </ThemedText>
          </View>
        )}
      </View>
    );
  }

  // Compact version for in-game display
  return (
    <View className="flex-row items-center gap-3">
      <View className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl px-3 py-1">
        <ThemedText className="text-2xl font-black text-white font-pixelpurl-medium">
          {score}
        </ThemedText>
      </View>

      <Animated.View
        className="bg-white/10 rounded-xl px-2 py-1"
        style={{ transform: [{ scale: streakAnimation }] }}
      >
        <ThemedText className="text-2xl font-bold text-white  font-pixelpurl-medium">
          {getStreakEmoji()} {streak}
        </ThemedText>
      </Animated.View>

      {totalQuestions > 0 && (
        <View className="bg-white/10 rounded-xl px-2 py-1">
          <ThemedText className="text-2xl font-semibold text-white/80 font-pixelpurl-medium">
            {accuracy.toFixed(0)}%
          </ThemedText>
        </View>
      )}
    </View>
  );
}
