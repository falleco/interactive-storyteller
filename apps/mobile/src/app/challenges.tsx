import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type React from 'react';
import { useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChallengeCard, useChallenges } from '~/features/challenges';
import { FloatingButton } from '~/shared/components/core/floating-button';
import { ThemedText } from '~/shared/components/themed-text';

export default function ChallengesScreen() {
  const { challenges, redeemChallenge } = useChallenges();

  const [refreshing, setRefreshing] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleRedeemChallenge = async (challengeId: string) => {
    try {
      await redeemChallenge(challengeId);
    } catch (error) {
      console.error('Error redeeming challenge:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh challenges data (already handled by the hook)
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <>
      <LinearGradient
        colors={['#9F7FFF', '#8055FE']}
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
      <SafeAreaView className="flex-1">
        <View className="px-6 mb-4">
          <ThemedText type="display" tone="accent" className="text-center">
            Challenges
          </ThemedText>
          <ThemedText type="subtitle" tone="muted" className="text-center mt-2">
            Track your progress and claim shimmering rewards for your practice.
          </ThemedText>
        </View>
        <ScrollView
          className="flex-1 pt-6"
          contentContainerClassName="pb-20"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Challenges List */}
          <View className="px-5">
            {challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onRedeem={handleRedeemChallenge}
              />
            ))}
          </View>

          {/* Bottom Spacing */}
          <View className="h-8" />
        </ScrollView>
        <View className="absolute bottom-10 right-0 left-0 justify-center items-center p-0 m-0">
          <FloatingButton
            size="lg"
            className="self-center"
            onPress={handleClose}
          />
        </View>
        <StatusBar barStyle="light-content" animated={true} />
      </SafeAreaView>
    </>
  );
}
