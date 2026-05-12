import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrency } from '~/features/currency';
import { useLuthier } from '~/features/luthier';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { InstrumentRarity } from '~/shared/types/music';
import { getInstrumentArtwork } from '~/features/instruments/utils/get-instrument-artwork';

export default function PurchasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const { currency, addGoldenShards } = useCurrency();
  const { instruments, buyInstrument } = useLuthier();

  const [isPurchasing, setIsPurchasing] = useState(false);

  // Find the instrument by ID
  const instrument = instruments.find((i) => i.id === id);

  if (!instrument) {
    return (
      <>
        <LinearGradient
          colors={['#1B1B3C', '#7F2866']}
          start={{ x: 0, y: 0.7 }}
          end={{ x: 0, y: 0 }}
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
          <View className="flex-1 justify-center items-center p-8">
            <ThemedText className="text-6xl mb-4">❌</ThemedText>
            <ThemedText className="text-2xl font-bold text-center text-white mb-4">
              Instrument Not Found
            </ThemedText>
            <FlatButton
              size="lg"
              onPress={() => router.back()}
              className="bg-red-800 border-red-400 border-4 rounded-2xl"
            >
              <FlatButtonText className="text-white text-xl font-boldpixels-medium">
                Go Back
              </FlatButtonText>
            </FlatButton>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const artwork = getInstrumentArtwork(instrument);

  const getRarityColor = () => {
    switch (instrument.rarity) {
      case InstrumentRarity.APPRENTICE:
        return '#6B7280';
      case InstrumentRarity.NORMAL:
        return '#3B82F6';
      case InstrumentRarity.PRO:
        return '#8B5CF6';
      case InstrumentRarity.EPIC:
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getRarityGradient = (): [string, string] => {
    switch (instrument.rarity) {
      case InstrumentRarity.APPRENTICE:
        return ['#4B5563', '#6B7280'];
      case InstrumentRarity.NORMAL:
        return ['#2563EB', '#3B82F6'];
      case InstrumentRarity.PRO:
        return ['#7C3AED', '#8B5CF6'];
      case InstrumentRarity.EPIC:
        return ['#D97706', '#F59E0B'];
      default:
        return ['#4B5563', '#6B7280'];
    }
  };

  const canAfford = currency.goldenNoteShards >= instrument.price;

  const handlePurchase = async () => {
    if (!canAfford) {
      Alert.alert(
        '💰 Insufficient Shards',
        `You need ${instrument.price} golden note shards to purchase this instrument. You currently have ${currency.goldenNoteShards}.\n\nComplete challenges to earn more shards!`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (instrument.isOwned) {
      Alert.alert('Already Owned', 'You already own this instrument!', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsPurchasing(true);

    try {
      const success = await buyInstrument(
        instrument.id,
        currency,
        async (newCurrency) => {
          await addGoldenShards(
            newCurrency.goldenNoteShards - currency.goldenNoteShards,
          );
        },
      );

      if (success) {
        Alert.alert(
          '🎉 Purchase Successful!',
          `You have successfully purchased the ${instrument.name}!\n\nThis instrument is now in your collection!`,
          [
            {
              text: 'View Collection',
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          'Something went wrong. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error purchasing instrument:', error);
      Alert.alert(
        'Error',
        'Failed to complete the purchase. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <LinearGradient
        colors={['#1B1B3C', '#7F2866']}
        start={{ x: 0, y: 0.7 }}
        end={{ x: 0, y: 0 }}
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
        {/* Header */}
        <View className="px-5 pt-4 flex-row items-center justify-between mb-4">
          <FlatButton
            size="sm"
            onPress={() => router.back()}
            className="bg-[#2a0f3d] border-white/20 border-2 rounded-xl"
          >
            <FlatButtonText className="text-white text-lg font-boldpixels-medium">
              ← Back
            </FlatButtonText>
          </FlatButton>

          <View className="bg-[#2a0f3d] border-white/20 border-2 rounded-xl px-4 py-2">
            <ThemedText className="text-lg font-boldpixels-medium text-orange-400">
              ✨ {currency.goldenNoteShards}
            </ThemedText>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="pb-24">
          <View className="px-5">
            {/* Instrument Display Card */}
            <View className="items-center mb-6">
              <LinearGradient
                colors={getRarityGradient()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  padding: 4,
                }}
              >
                <View className="bg-[#2a0f3d] rounded-2xl p-8 items-center justify-center min-h-[280px]">
                  {/* Instrument Icon */}
                  <View className="mb-4 items-center justify-center bg-white/10 rounded-full w-40 h-40">
                    {artwork ? (
                      <Image
                        source={artwork}
                        resizeMode="contain"
                        style={{ width: 128, height: 128 }}
                      />
                    ) : (
                      <ThemedText className="text-[120px]">
                        {instrument.icon}
                      </ThemedText>
                    )}
                  </View>

                  {/* Instrument Name */}
                  <ThemedText className="text-4xl font-bold text-center text-white font-boldpixels-medium mb-2">
                    {instrument.name}
                  </ThemedText>

                  {/* Rarity Badge */}
                  <View
                    className="px-4 py-2 rounded-full mb-4"
                    style={{ backgroundColor: `${getRarityColor()}30` }}
                  >
                    <ThemedText
                      className="text-lg font-semibold uppercase font-boldpixels-medium"
                      style={{ color: getRarityColor() }}
                    >
                      {instrument.rarity}
                    </ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Description Section */}
            <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-4">
              <ThemedText className="text-lg font-bold mb-2 text-white font-boldpixels-medium">
                📜 Description
              </ThemedText>
              <ThemedText className="text-base text-white/80 leading-6">
                {instrument.description}
              </ThemedText>
            </View>

            {/* Stats Section */}
            <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-4">
              <ThemedText className="text-lg font-bold mb-4 text-white font-boldpixels-medium">
                ⚡ Bonuses
              </ThemedText>

              {/* Score Multiplier */}
              <View className="flex-row justify-between items-center mb-3 bg-white/5 p-3 rounded-xl">
                <View className="flex-row items-center">
                  <ThemedText className="text-2xl mr-2">🎯</ThemedText>
                  <ThemedText className="text-base text-white/90">
                    Score Multiplier
                  </ThemedText>
                </View>
                <ThemedText className="text-xl font-bold text-orange-400 font-boldpixels-medium">
                  {instrument.bonuses.scoreMultiplier.toFixed(1)}x
                </ThemedText>
              </View>

              {/* Accuracy Bonus */}
              <View className="flex-row justify-between items-center mb-3 bg-white/5 p-3 rounded-xl">
                <View className="flex-row items-center">
                  <ThemedText className="text-2xl mr-2">🎵</ThemedText>
                  <ThemedText className="text-base text-white/90">
                    Accuracy Bonus
                  </ThemedText>
                </View>
                <ThemedText className="text-xl font-bold text-green-400 font-boldpixels-medium">
                  +{instrument.bonuses.accuracyBonus}%
                </ThemedText>
              </View>

              {/* Streak Bonus */}
              <View className="flex-row justify-between items-center bg-white/5 p-3 rounded-xl">
                <View className="flex-row items-center">
                  <ThemedText className="text-2xl mr-2">🔥</ThemedText>
                  <ThemedText className="text-base text-white/90">
                    Streak Bonus
                  </ThemedText>
                </View>
                <ThemedText className="text-xl font-bold text-red-400 font-boldpixels-medium">
                  +{instrument.bonuses.streakBonus}
                </ThemedText>
              </View>
            </View>

            {/* Price Display */}
            <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-6">
              <View className="flex-row justify-between items-center">
                <ThemedText className="text-xl font-bold text-white font-boldpixels-medium">
                  💎 Price
                </ThemedText>
                <ThemedText className="text-3xl font-bold text-orange-400 font-boldpixels-medium">
                  ✨ {instrument.price}
                </ThemedText>
              </View>

              {!canAfford && (
                <View className="mt-3 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                  <ThemedText className="text-sm text-red-300 text-center">
                    You need {instrument.price - currency.goldenNoteShards} more
                    shards
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Purchase Button */}
            {instrument.isOwned ? (
              <FlatButton
                size="xl"
                isDisabled
                className="w-full rounded-2xl py-4 border-4 border-green-400 bg-green-800"
              >
                <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                  ✓ Already Owned
                </FlatButtonText>
              </FlatButton>
            ) : (
              <FlatButton
                size="xl"
                onPress={handlePurchase}
                isDisabled={!canAfford || isPurchasing}
                className={`w-full rounded-2xl py-4 border-4 ${
                  canAfford
                    ? 'border-orange-400 bg-orange-800'
                    : 'border-gray-400 bg-gray-800 opacity-50'
                }`}
              >
                <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                  {isPurchasing
                    ? '⌛ Processing...'
                    : canAfford
                      ? '🛒 Purchase Now'
                      : '🔒 Insufficient Shards'}
                </FlatButtonText>
              </FlatButton>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
