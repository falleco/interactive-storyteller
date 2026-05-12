import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import React, { useEffect } from 'react';
import { TouchableWithoutFeedback, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useGameContext } from '~/features/game';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import type { GameSettings } from '~/shared/types/music';
import { GameMode } from '~/shared/types/music';

const gameModes: {
  mode: GameMode;
  title: string;
  description: string;
  icon: string;
  path: Href;
}[] = [
  {
    mode: GameMode.SINGLE_NOTE,
    title: 'Single Note',
    description:
      'Identify individual notes on the staff. Perfect for beginners!',
    icon: '🎵',
    path: '/game/single-note',
  },
  {
    mode: GameMode.SEQUENCE,
    title: 'Note Sequence',
    description:
      'Identify multiple notes in the correct order. Build your skills!',
    icon: '🎼',
    path: '/game/sequence',
  },
  {
    mode: GameMode.RHYTHM,
    title: 'Rhythm Hero',
    description: 'Guitar Hero style! Hit notes as they cross the line.',
    icon: '🎸',
    path: '/game/rhythm',
  },
];

export default function GameModesScreen() {
  const { gameLogic, gameSettings } = useGameContext();

  const opacity = useSharedValue(0);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
  }));

  useEffect(() => {
    opacity.value = withTiming(1);
  }, [opacity]);

  const handleModeSelect = (mode: GameMode) => {
    const gameMode = gameModes.find((gameMode) => gameMode.mode === mode)!;
    gameSettings.updateGameMode(mode);
    gameLogic.startGame(gameSettings.gameSettings);
    router.replace(gameMode.path);
  };

  return (
    <View className="flex-1 justify-center items-center">
      <TouchableWithoutFeedback onPress={() => router.back()}>
        <Animated.View
          className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 justify-center items-center"
          style={backdropAnimatedStyle}
        />
      </TouchableWithoutFeedback>
      <View className="space-y-4 bg-[#160E22EE] border-2 border-white/20 rounded-3xl p-6 items-center relative">
        <View className="absolute -top-16 left-0 right-0 justify-center items-center">
          <Image
            source={require('@/assets/images/hud/dices_red_512.png')}
            style={{
              width: 100,
              height: 100,
              marginLeft: 20,
            }}
            contentFit="cover"
            // transition={1000}
          />
        </View>
        {gameModes.map((gameMode, index) => {
          return (
            <FlatButton
              key={gameMode.mode}
              size="xl"
              onPress={() => handleModeSelect(gameMode.mode)}
              className="relative overflow-hidden rounded-3xl px-6"
            >
              <View className="items-center">
                <FlatButtonText className="text-2xl font-black text-white mb-2 text-center font-boldpixels-medium">
                  {gameMode.title.toUpperCase()}
                </FlatButtonText>
              </View>
            </FlatButton>
          );
        })}
      </View>
    </View>
  );
}
