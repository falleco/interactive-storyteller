import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ParallaxBg } from '~/shared/components/parallax-bg';
import { ThemedText } from '~/shared/components/themed-text';

export default function HomeTab() {
  const { top } = useSafeAreaInsets();

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  };

  const handleChallengesPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/challenges');
  };

  const handleStartGamePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/game-modes');
  };

  return (
    <>
      <ParallaxBg className="absolute top-0 left-0 right-0 bottom-0 bg-[#1B1B3C]" />
      <View
        className="flex-1 flex-col justify-center items-center"
        style={{ paddingTop: top }}
      >
        <View className="w-full h-auto flex-grow-0 flex-row justify-between items-center">
          <FlatButton
            size="lg"
            onPress={handleSettingsPress}
            className="flex-col items-center"
          >
            <Image
              style={{ width: 72, height: 72, marginLeft: -16, marginTop: -12 }}
              source={require('@/assets/images/hud/settings.png')}
            />
            <ThemedText
              type="label"
              tone="secondary"
              className="-mt-4 -ml-4 text-[#ffffff] font-pixelpurl-medium text-xl"
            >
              settings
            </ThemedText>
          </FlatButton>
          <FlatButton
            size="lg"
            onPress={handleChallengesPress}
            className="justify-start flex-col items-center"
          >
            <Image
              style={{ width: 48, height: 48, marginTop: 6 }}
              source={require('@/assets/images/hud/book.png')}
            />
            <ThemedText
              type="label"
              tone="secondary"
              className="text-[#ffffff] font-pixelpurl-medium text-xl"
            >
              challenges
            </ThemedText>
          </FlatButton>
        </View>
        <View className="flex-grow" />
        <View className="flex-grow-0 justify-center items-center pb-56">
          <FlatButton
            size="xl"
            onPress={handleStartGamePress}
            className="w-full max-w-sm -mb-6 rounded-2xl px-4 py-2 border-red-400 bg-red-800  border-4"
          >
            <FlatButtonText
              tone="secondary"
              className="text-[#ffffff] font-pixelpurl-medium text-2xl"
            >
              START PLAYING
            </FlatButtonText>
          </FlatButton>
        </View>
      </View>
      <StatusBar style="light" hidden={true} />
    </>
  );
}
