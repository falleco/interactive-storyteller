import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { ThemedView } from '~/shared/components/themed-view';
import type { ScoreDisplayProps } from '../game/score-display';
import { ScoreDisplay } from '../game/score-display';

interface GameScreenLayoutProps {
  isGameActive: boolean;
  onEndGame: () => void;
  children: ReactNode;
  scoreboard: ScoreDisplayProps;
  gradientColors?: [string, string];
  inactiveMessage?: {
    title: string;
    subtitle?: string;
  };
  headerRight?: ReactNode;
  endGameLabel?: string;
}

/**
 * Shared presentation shell for note-based game screens.
 * Handles the gradient backdrop, scoreboard header, and end-game action.
 */
export function GameScreenLayout({
  isGameActive,
  onEndGame,
  children,
  scoreboard,
  gradientColors = ['#9F7FFF', '#8055FE'],
  inactiveMessage = {
    title: 'Game Not Active',
    subtitle: 'Please start a new game to continue',
  },
  headerRight,
  endGameLabel = 'End Game',
}: GameScreenLayoutProps) {
  const { top } = useSafeAreaInsets();

  if (!isGameActive) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText className="text-2xl font-bold text-center">
          {inactiveMessage.title}
        </ThemedText>
        {inactiveMessage.subtitle ? (
          <ThemedText className="text-sm opacity-70 text-center mt-2">
            {inactiveMessage.subtitle}
          </ThemedText>
        ) : null}
      </ThemedView>
    );
  }

  return (
    <>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      <View
        className="flex-1"
        style={{
          paddingTop: top,
        }}
      >
        <View className="flex-row justify-between items-center px-4 py-3 bg-black/30 backdrop-blur-sm border-b border-white/10">
          <ScoreDisplay {...scoreboard} />

          {headerRight ?? (
            <FlatButton
              size="sm"
              onPress={onEndGame}
              className="rounded-xl px-4 py-2 border-red-400 bg-red-800 text-[#ffffff] border-2"
            >
              <FlatButtonText className="text-sm font-bold text-white font-pixelpurl-medium uppercase tracking-wider">
                {endGameLabel}
              </FlatButtonText>
            </FlatButton>
          )}
        </View>

        <View className="flex-1">{children}</View>
      </View>
    </>
  );
}
