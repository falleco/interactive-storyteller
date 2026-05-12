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

export default function InstrumentManagePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const { currency, addGoldenShards } = useCurrency();
  const { instruments, upgradeInstrument, tuneInstrument, equipInstrument } =
    useLuthier();

  const [isProcessing, setIsProcessing] = useState(false);

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
        return '#6B7280'; // Steel grey for apprentice gear
      case InstrumentRarity.NORMAL:
        return '#3B82F6'; // Vibrant blue for seasoned gear
      case InstrumentRarity.PRO:
        return '#8B5CF6'; // Royal purple for pro gear
      case InstrumentRarity.EPIC:
        return '#F59E0B'; // Radiant gold for epic gear
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

  const getTuningColor = () => {
    if (instrument.tuning >= 90) return '#10B981'; // Green
    if (instrument.tuning >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const canAffordUpgrade = currency.goldenNoteShards >= instrument.upgradePrice;
  const canAffordTune = currency.goldenNoteShards >= instrument.tunePrice;

  const handleUpgrade = async () => {
    if (!canAffordUpgrade) {
      Alert.alert(
        '💰 Insufficient Shards',
        `You need ${instrument.upgradePrice} golden note shards to upgrade this instrument. You currently have ${currency.goldenNoteShards}.`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (instrument.level >= 10) {
      Alert.alert('Max Level', 'This instrument is already at maximum level!', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsProcessing(true);

    try {
      const success = await upgradeInstrument(
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
          '🎉 Upgrade Successful!',
          `${instrument.name} has been upgraded to level ${instrument.level + 1}!`,
          [{ text: 'Excellent!' }],
        );
      } else {
        Alert.alert(
          'Upgrade Failed',
          'Something went wrong. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error upgrading instrument:', error);
      Alert.alert('Error', 'Failed to upgrade. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTune = async () => {
    if (!canAffordTune) {
      Alert.alert(
        '💰 Insufficient Shards',
        `You need ${instrument.tunePrice} golden note shards to tune this instrument. You currently have ${currency.goldenNoteShards}.`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (instrument.tuning >= 100) {
      Alert.alert(
        'Perfect Tuning',
        'This instrument is already perfectly tuned!',
        [{ text: 'OK' }],
      );
      return;
    }

    setIsProcessing(true);

    try {
      const success = await tuneInstrument(
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
          '🎵 Tuning Successful!',
          `${instrument.name} has been tuned and sounds better than ever!`,
          [{ text: 'Perfect!' }],
        );
      } else {
        Alert.alert(
          'Tuning Failed',
          'Something went wrong. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error tuning instrument:', error);
      Alert.alert('Error', 'Failed to tune. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEquip = async () => {
    setIsProcessing(true);

    try {
      await equipInstrument(instrument.id);
      Alert.alert(
        '✅ Instrument Equipped!',
        `${instrument.name} is now equipped and ready to play!`,
        [{ text: 'Great!' }],
      );
    } catch (error) {
      console.error('Error equipping instrument:', error);
      Alert.alert('Error', 'Failed to equip instrument. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
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

                  {/* Rarity Badge & Level */}
                  <View className="flex-row items-center gap-2">
                    <View
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: `${getRarityColor()}30` }}
                    >
                      <ThemedText
                        className="text-lg font-semibold uppercase font-boldpixels-medium"
                        style={{ color: getRarityColor() }}
                      >
                        {instrument.rarity}
                      </ThemedText>
                    </View>

                    <View className="px-4 py-2 rounded-full bg-blue-500/30">
                      <ThemedText className="text-lg font-semibold text-blue-300 font-boldpixels-medium">
                        Level {instrument.level}
                      </ThemedText>
                    </View>

                    {instrument.isEquipped && (
                      <View className="px-4 py-2 rounded-full bg-green-500">
                        <ThemedText className="text-lg font-semibold text-white font-boldpixels-medium">
                          ✓ Equipped
                        </ThemedText>
                      </View>
                    )}
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

            {/* Tuning Section */}
            <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-4">
              <ThemedText className="text-lg font-bold mb-3 text-white font-boldpixels-medium">
                🎵 Tuning
              </ThemedText>

              <View className="flex-row items-center justify-between mb-2">
                <ThemedText className="text-base text-white/90">
                  Current Tuning
                </ThemedText>
                <View className="flex-row items-center gap-2">
                  <View className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: getTuningColor(),
                        width: `${instrument.tuning}%`,
                      }}
                    />
                  </View>
                  <ThemedText
                    className="text-xl font-bold font-boldpixels-medium"
                    style={{ color: getTuningColor() }}
                  >
                    {instrument.tuning}%
                  </ThemedText>
                </View>
              </View>

              {instrument.tuning < 100 && (
                <View className="mt-2 bg-orange-500/20 border border-orange-500/40 rounded-xl p-3">
                  <ThemedText className="text-sm text-orange-200">
                    💡 Tuning your instrument improves accuracy and sound
                    quality!
                  </ThemedText>
                </View>
              )}
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

            {/* Action Buttons */}
            <View className="gap-3">
              {/* Equip Button (if not equipped) */}
              {!instrument.isEquipped && (
                <FlatButton
                  size="xl"
                  onPress={handleEquip}
                  isDisabled={isProcessing}
                  className="w-full rounded-2xl py-4 border-4 border-green-400 bg-green-800"
                >
                  <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                    {isProcessing ? '⌛ Processing...' : '✓ Equip Instrument'}
                  </FlatButtonText>
                </FlatButton>
              )}

              {/* Equipped Badge */}
              {instrument.isEquipped && (
                <View className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 border-4 border-green-400">
                  <ThemedText className="text-2xl font-bold text-center text-white font-boldpixels-medium">
                    ✓ Currently Equipped
                  </ThemedText>
                  <ThemedText className="text-sm text-center text-white/80 mt-1">
                    This instrument is ready to play!
                  </ThemedText>
                </View>
              )}

              {/* Tune Button (if not perfect tuning) */}
              {instrument.tuning < 100 && (
                <>
                  <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5">
                    <View className="flex-row justify-between items-center">
                      <ThemedText className="text-xl font-bold text-white font-boldpixels-medium">
                        🎵 Tuning Cost
                      </ThemedText>
                      <ThemedText className="text-3xl font-bold text-purple-400 font-boldpixels-medium">
                        ✨ {instrument.tunePrice}
                      </ThemedText>
                    </View>

                    {!canAffordTune && (
                      <View className="mt-3 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                        <ThemedText className="text-sm text-red-300 text-center">
                          You need{' '}
                          {instrument.tunePrice - currency.goldenNoteShards}{' '}
                          more shards
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <FlatButton
                    size="xl"
                    onPress={handleTune}
                    isDisabled={!canAffordTune || isProcessing}
                    className={`w-full rounded-2xl py-4 border-4 ${
                      canAffordTune
                        ? 'border-purple-400 bg-purple-800'
                        : 'border-gray-400 bg-gray-800 opacity-50'
                    }`}
                  >
                    <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                      {isProcessing
                        ? '⌛ Processing...'
                        : canAffordTune
                          ? '🎵 Tune Instrument'
                          : '🔒 Insufficient Shards'}
                    </FlatButtonText>
                  </FlatButton>
                </>
              )}

              {/* Perfect Tuning Badge */}
              {instrument.tuning >= 100 && (
                <View className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 border-4 border-green-400">
                  <ThemedText className="text-2xl font-bold text-center text-white font-boldpixels-medium">
                    🎵 Perfectly Tuned 🎵
                  </ThemedText>
                  <ThemedText className="text-sm text-center text-white/80 mt-1">
                    This instrument is in perfect condition!
                  </ThemedText>
                </View>
              )}

              {/* Upgrade Button (if not max level) */}
              {instrument.level < 10 && (
                <>
                  <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5">
                    <View className="flex-row justify-between items-center">
                      <ThemedText className="text-xl font-bold text-white font-boldpixels-medium">
                        ⬆️ Upgrade Cost
                      </ThemedText>
                      <ThemedText className="text-3xl font-bold text-blue-400 font-boldpixels-medium">
                        ✨ {instrument.upgradePrice}
                      </ThemedText>
                    </View>

                    {!canAffordUpgrade && (
                      <View className="mt-3 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                        <ThemedText className="text-sm text-red-300 text-center">
                          You need{' '}
                          {instrument.upgradePrice - currency.goldenNoteShards}{' '}
                          more shards
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <FlatButton
                    size="xl"
                    onPress={handleUpgrade}
                    isDisabled={!canAffordUpgrade || isProcessing}
                    className={`w-full rounded-2xl py-4 border-4 ${
                      canAffordUpgrade
                        ? 'border-blue-400 bg-blue-800'
                        : 'border-gray-400 bg-gray-800 opacity-50'
                    }`}
                  >
                    <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                      {isProcessing
                        ? '⌛ Processing...'
                        : canAffordUpgrade
                          ? `⬆️ Upgrade to Lv.${instrument.level + 1}`
                          : '🔒 Insufficient Shards'}
                    </FlatButtonText>
                  </FlatButton>
                </>
              )}

              {/* Max Level Badge */}
              {instrument.level >= 10 && (
                <View className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-5 border-4 border-yellow-400">
                  <ThemedText className="text-2xl font-bold text-center text-black font-boldpixels-medium">
                    🏆 MAX LEVEL 🏆
                  </ThemedText>
                  <ThemedText className="text-sm text-center text-black/80 mt-1">
                    This instrument is fully upgraded!
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
