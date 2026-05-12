import type React from 'react';
import { Alert, Image, type StyleProp, View, type ViewStyle } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';
import type { Instrument, UserCurrency } from '~/shared/types/music';
import { InstrumentRarity } from '~/shared/types/music';
import { getInstrumentArtwork } from '~/features/instruments/utils/get-instrument-artwork';

interface InstrumentCardProps {
  className?: string;
  instrument: Instrument;
  style?: ViewStyle;
  currency: UserCurrency;
  onBuy: (instrumentId: string) => Promise<boolean>;
  onUpgrade: (instrumentId: string) => Promise<boolean>;
  onTune: (instrumentId: string) => Promise<boolean>;
  onEquip: (instrumentId: string) => Promise<void>;
}

/**
 * Instrument card component for the luthier shop
 *
 * Displays instrument details, stats, and available actions based on ownership status.
 * Handles purchasing, upgrading, tuning, and equipping instruments.
 *
 * @param instrument - The instrument data to display
 * @param currency - Current user currency
 * @param onBuy - Callback when user buys an instrument
 * @param onUpgrade - Callback when user upgrades an instrument
 * @param onTune - Callback when user tunes an instrument
 * @param onEquip - Callback when user equips an instrument
 */
export function InstrumentCard({
  style,
  className,
  instrument,
  currency,
  onBuy,
  onUpgrade,
  onTune,
  onEquip,
}: InstrumentCardProps) {
  const cardBackgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');
  const artwork = getInstrumentArtwork(instrument);

  const getRarityColor = () => {
    switch (instrument.rarity) {
      case InstrumentRarity.APPRENTICE:
        return '#6B7280'; // Gray
      case InstrumentRarity.NORMAL:
        return '#3B82F6'; // Blue
      case InstrumentRarity.PRO:
        return '#8B5CF6'; // Purple
      case InstrumentRarity.EPIC:
        return '#F59E0B'; // Gold
      default:
        return '#6B7280';
    }
  };

  const getTuningColor = () => {
    if (instrument.tuning >= 90) return '#10B981'; // Green
    if (instrument.tuning >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const handleBuyPress = async () => {
    if (currency.goldenNoteShards < instrument.price) {
      Alert.alert(
        'Insufficient Funds',
        `You need ${instrument.price} golden note shards to buy this instrument. You currently have ${currency.goldenNoteShards}.`,
        [{ text: 'OK' }],
      );
      return;
    }

    const success = await onBuy(instrument.id);
    if (success) {
      Alert.alert(
        'Purchase Successful!',
        `You have successfully purchased the ${instrument.name}!`,
        [{ text: 'Great!' }],
      );
    }
  };

  const handleUpgradePress = async () => {
    if (currency.goldenNoteShards < instrument.upgradePrice) {
      Alert.alert(
        'Insufficient Funds',
        `You need ${instrument.upgradePrice} golden note shards to upgrade this instrument.`,
        [{ text: 'OK' }],
      );
      return;
    }

    const success = await onUpgrade(instrument.id);
    if (success) {
      Alert.alert(
        'Upgrade Successful!',
        `Your ${instrument.name} has been upgraded to level ${instrument.level + 1}!`,
        [{ text: 'Excellent!' }],
      );
    }
  };

  const handleTunePress = async () => {
    if (currency.goldenNoteShards < instrument.tunePrice) {
      Alert.alert(
        'Insufficient Funds',
        `You need ${instrument.tunePrice} golden note shards to tune this instrument.`,
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

    const success = await onTune(instrument.id);
    if (success) {
      Alert.alert(
        'Tuning Complete!',
        `Your ${instrument.name} has been tuned and sounds better than ever!`,
        [{ text: 'Perfect!' }],
      );
    }
  };

  const handleEquipPress = async () => {
    await onEquip(instrument.id);
    Alert.alert(
      'Instrument Equipped!',
      `You are now playing with the ${instrument.name}!`,
      [{ text: 'Ready to play!' }],
    );
  };

  return (
    <View
      className={cn('mb-4 p-4 rounded-2xl border-2 border-gray-200', className)}
      style={{ backgroundColor: cardBackgroundColor, ...(style ?? {}) }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View className="mr-3 items-center justify-center">
            {artwork ? (
              <Image
                source={artwork}
                resizeMode="contain"
                style={{ width: 52, height: 52 }}
              />
            ) : (
              <ThemedText className="text-3xl">{instrument.icon}</ThemedText>
            )}
          </View>
          <View className="flex-1">
            <ThemedText
              className="text-lg font-semibold"
              style={{ color: textColor }}
            >
              {instrument.name}
            </ThemedText>
            <View className="flex-row items-center mt-1">
              <View
                className="px-2 py-1 rounded-full mr-2"
                style={{ backgroundColor: `${getRarityColor()}20` }}
              >
                <ThemedText
                  className="text-xs font-medium capitalize"
                  style={{ color: getRarityColor() }}
                >
                  {instrument.rarity}
                </ThemedText>
              </View>
              <ThemedText
                className="text-xs"
                style={{ color: secondaryTextColor }}
              >
                Level {instrument.level}
              </ThemedText>
              {instrument.isEquipped && (
                <View className="ml-2 px-2 py-1 rounded-full bg-green-500">
                  <ThemedText className="text-xs font-medium text-white">
                    Equipped
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Description */}
      <ThemedText
        className="text-sm mb-3"
        style={{ color: secondaryTextColor }}
      >
        {instrument.description}
      </ThemedText>

      {/* Stats */}
      {instrument.isOwned && (
        <View className="mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <ThemedText
              className="text-sm font-medium"
              style={{ color: textColor }}
            >
              Instrument Stats
            </ThemedText>
          </View>

          {/* Tuning */}
          <View className="flex-row justify-between items-center mb-1">
            <ThemedText
              className="text-sm"
              style={{ color: secondaryTextColor }}
            >
              Tuning
            </ThemedText>
            <View className="flex-row items-center">
              <View className="w-20 h-2 bg-gray-200 rounded-full mr-2">
                <View
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: getTuningColor(),
                    width: `${instrument.tuning}%`,
                  }}
                />
              </View>
              <ThemedText
                className="text-sm"
                style={{ color: getTuningColor() }}
              >
                {instrument.tuning}%
              </ThemedText>
            </View>
          </View>

          {/* Bonuses */}
          <View className="flex-row justify-between items-center mb-1">
            <ThemedText
              className="text-sm"
              style={{ color: secondaryTextColor }}
            >
              Score Multiplier
            </ThemedText>
            <ThemedText className="text-sm" style={{ color: primaryColor }}>
              {instrument.bonuses.scoreMultiplier.toFixed(1)}x
            </ThemedText>
          </View>

          <View className="flex-row justify-between items-center mb-1">
            <ThemedText
              className="text-sm"
              style={{ color: secondaryTextColor }}
            >
              Accuracy Bonus
            </ThemedText>
            <ThemedText className="text-sm" style={{ color: primaryColor }}>
              +{instrument.bonuses.accuracyBonus}%
            </ThemedText>
          </View>

          <View className="flex-row justify-between items-center">
            <ThemedText
              className="text-sm"
              style={{ color: secondaryTextColor }}
            >
              Streak Bonus
            </ThemedText>
            <ThemedText className="text-sm" style={{ color: primaryColor }}>
              +{instrument.bonuses.streakBonus}
            </ThemedText>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row space-x-2">
        {!instrument.isOwned && (
          <View className="flex-1">
            <Button
              size="sm"
              variant="solid"
              onPress={handleBuyPress}
              isDisabled={currency.goldenNoteShards < instrument.price}
            >
              <ButtonText>Buy - ✨{instrument.price}</ButtonText>
            </Button>
          </View>
        )}

        {instrument.isOwned && !instrument.isEquipped && (
          <View className="flex-1">
            <Button size="sm" variant="solid" onPress={handleEquipPress}>
              <ButtonText>Equip</ButtonText>
            </Button>
          </View>
        )}

        {instrument.isOwned && instrument.tuning < 100 && (
          <View className="flex-1">
            <Button
              size="sm"
              variant="outline"
              onPress={handleTunePress}
              isDisabled={currency.goldenNoteShards < instrument.tunePrice}
            >
              <ButtonText>Tune - ✨{instrument.tunePrice}</ButtonText>
            </Button>
          </View>
        )}

        {instrument.isOwned && instrument.level < 10 && (
          <View className="flex-1">
            <Button
              size="sm"
              variant="outline"
              onPress={handleUpgradePress}
              isDisabled={currency.goldenNoteShards < instrument.upgradePrice}
            >
              <ButtonText>Upgrade - ✨{instrument.upgradePrice}</ButtonText>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
}
