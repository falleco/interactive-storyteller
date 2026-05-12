import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrency } from '~/features/currency';
import { useEquipment } from '~/features/equipment';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { EquipmentRarity } from '~/shared/types/music';

export default function EquipmentManagePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const { currency, addGoldenShards } = useCurrency();
  const { equipment, buyEquipment, upgradeEquipment, equipItem, unequipItem } =
    useEquipment();

  const [isProcessing, setIsProcessing] = useState(false);

  // Find the equipment by ID
  const item = equipment.find((e) => e.id === id);

  if (!item) {
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
          <View className="flex-1 justify-center items-center p-8">
            <ThemedText className="text-6xl mb-4">❌</ThemedText>
            <ThemedText className="text-2xl font-bold text-center text-white mb-4">
              Equipment Not Found
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

  const getRarityColor = () => {
    switch (item.rarity) {
      case EquipmentRarity.COMMON:
        return '#6B7280'; // Gray
      case EquipmentRarity.RARE:
        return '#3B82F6'; // Blue
      case EquipmentRarity.EPIC:
        return '#8B5CF6'; // Purple
      case EquipmentRarity.LEGENDARY:
        return '#F59E0B'; // Gold
      default:
        return '#6B7280';
    }
  };

  const getRarityGradient = (): [string, string] => {
    switch (item.rarity) {
      case EquipmentRarity.COMMON:
        return ['#4B5563', '#6B7280'];
      case EquipmentRarity.RARE:
        return ['#2563EB', '#3B82F6'];
      case EquipmentRarity.EPIC:
        return ['#7C3AED', '#8B5CF6'];
      case EquipmentRarity.LEGENDARY:
        return ['#D97706', '#F59E0B'];
      default:
        return ['#4B5563', '#6B7280'];
    }
  };

  const canAffordPurchase = currency.goldenNoteShards >= item.price;
  const canAffordUpgrade = currency.goldenNoteShards >= item.upgradePrice;

  const handlePurchase = async () => {
    if (!canAffordPurchase) {
      Alert.alert(
        '💰 Insufficient Shards',
        `You need ${item.price} golden note shards to purchase this equipment. You currently have ${currency.goldenNoteShards}.\n\nComplete challenges to earn more shards!`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (item.isOwned) {
      Alert.alert('Already Owned', 'You already own this equipment!', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsProcessing(true);

    try {
      const success = await buyEquipment(
        item.id,
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
          `You have successfully purchased ${item.name}!\n\nThis equipment is now in your collection!`,
          [{ text: 'Awesome!' }],
        );
      } else {
        Alert.alert(
          'Purchase Failed',
          'Something went wrong. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      console.error('Error purchasing equipment:', error);
      Alert.alert(
        'Error',
        'Failed to complete the purchase. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgrade = async () => {
    if (!canAffordUpgrade) {
      Alert.alert(
        '💰 Insufficient Shards',
        `You need ${item.upgradePrice} golden note shards to upgrade this equipment. You currently have ${currency.goldenNoteShards}.`,
        [{ text: 'OK' }],
      );
      return;
    }

    if (item.level >= 10) {
      Alert.alert('Max Level', 'This equipment is already at maximum level!', [
        { text: 'OK' },
      ]);
      return;
    }

    setIsProcessing(true);

    try {
      const success = await upgradeEquipment(
        item.id,
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
          `${item.name} has been upgraded to level ${item.level + 1}!`,
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
      console.error('Error upgrading equipment:', error);
      Alert.alert('Error', 'Failed to upgrade. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEquip = async () => {
    setIsProcessing(true);

    try {
      await equipItem(item.id);
      Alert.alert(
        '✅ Equipment Equipped!',
        `${item.name} is now equipped and providing bonuses!`,
        [{ text: 'Great!' }],
      );
    } catch (error) {
      console.error('Error equipping item:', error);
      Alert.alert('Error', 'Failed to equip item. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnequip = async () => {
    setIsProcessing(true);

    try {
      await unequipItem(item.id);
      Alert.alert(
        '✅ Equipment Unequipped!',
        `${item.name} has been unequipped.`,
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('Error unequipping item:', error);
      Alert.alert('Error', 'Failed to unequip item. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsProcessing(false);
    }
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
            {/* Equipment Display Card */}
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
                  {/* Equipment Icon */}
                  <View className="mb-4 items-center justify-center bg-white/10 rounded-full w-40 h-40">
                    <ThemedText className="text-[120px]">
                      {item.icon}
                    </ThemedText>
                  </View>

                  {/* Equipment Name */}
                  <ThemedText className="text-4xl font-bold text-center text-white font-boldpixels-medium mb-2">
                    {item.name}
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
                        {item.rarity}
                      </ThemedText>
                    </View>

                    {item.isOwned && (
                      <View className="px-4 py-2 rounded-full bg-blue-500/30">
                        <ThemedText className="text-lg font-semibold text-blue-300 font-boldpixels-medium">
                          Level {item.level}
                        </ThemedText>
                      </View>
                    )}

                    {item.isEquipped && (
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
                {item.description}
              </ThemedText>
            </View>

            {/* Stats Section */}
            <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-4">
              <ThemedText className="text-lg font-bold mb-4 text-white font-boldpixels-medium">
                ⚡ Bonuses
              </ThemedText>

              {/* Score Bonus */}
              <View className="flex-row justify-between items-center mb-3 bg-white/5 p-3 rounded-xl">
                <View className="flex-row items-center">
                  <ThemedText className="text-2xl mr-2">🎯</ThemedText>
                  <ThemedText className="text-base text-white/90">
                    Score Bonus
                  </ThemedText>
                </View>
                <ThemedText className="text-xl font-bold text-orange-400 font-boldpixels-medium">
                  +{item.bonuses.scoreBonus}
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
                  +{item.bonuses.accuracyBonus}%
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
                  +{item.bonuses.streakBonus}
                </ThemedText>
              </View>

              {/* Special Effect */}
              {item.bonuses.specialEffect && (
                <View className="mt-3 bg-purple-500/20 border border-purple-500/40 rounded-xl p-3">
                  <ThemedText className="text-sm text-purple-200 font-semibold">
                    ✨ Special Effect
                  </ThemedText>
                  <ThemedText className="text-base text-purple-100 mt-1">
                    {item.bonuses.specialEffect}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View className="gap-3">
              {/* Purchase Button (if not owned) */}
              {!item.isOwned && (
                <>
                  <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5 mb-2">
                    <View className="flex-row justify-between items-center">
                      <ThemedText className="text-xl font-bold text-white font-boldpixels-medium">
                        💎 Price
                      </ThemedText>
                      <ThemedText className="text-3xl font-bold text-orange-400 font-boldpixels-medium">
                        ✨ {item.price}
                      </ThemedText>
                    </View>

                    {!canAffordPurchase && (
                      <View className="mt-3 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                        <ThemedText className="text-sm text-red-300 text-center">
                          You need {item.price - currency.goldenNoteShards} more
                          shards
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <FlatButton
                    size="xl"
                    onPress={handlePurchase}
                    isDisabled={!canAffordPurchase || isProcessing}
                    className={`w-full rounded-2xl py-4 border-4 ${
                      canAffordPurchase
                        ? 'border-orange-400 bg-orange-800'
                        : 'border-gray-400 bg-gray-800 opacity-50'
                    }`}
                  >
                    <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                      {isProcessing
                        ? '⌛ Processing...'
                        : canAffordPurchase
                          ? '🛒 Purchase Now'
                          : '🔒 Insufficient Shards'}
                    </FlatButtonText>
                  </FlatButton>
                </>
              )}

              {/* Owned Equipment Actions */}
              {item.isOwned && (
                <>
                  {/* Equip/Unequip Button */}
                  {item.isEquipped ? (
                    <FlatButton
                      size="xl"
                      onPress={handleUnequip}
                      isDisabled={isProcessing}
                      className="w-full rounded-2xl py-4 border-4 border-red-400 bg-red-800"
                    >
                      <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                        {isProcessing ? '⌛ Processing...' : '✖ Unequip'}
                      </FlatButtonText>
                    </FlatButton>
                  ) : (
                    <FlatButton
                      size="xl"
                      onPress={handleEquip}
                      isDisabled={isProcessing}
                      className="w-full rounded-2xl py-4 border-4 border-green-400 bg-green-800"
                    >
                      <FlatButtonText className="text-white text-2xl font-boldpixels-medium text-center">
                        {isProcessing ? '⌛ Processing...' : '✓ Equip Now'}
                      </FlatButtonText>
                    </FlatButton>
                  )}

                  {/* Upgrade Button (if not max level) */}
                  {item.level < 10 && (
                    <>
                      <View className="bg-[#2a0f3d] border-2 border-white/20 rounded-2xl p-5">
                        <View className="flex-row justify-between items-center">
                          <ThemedText className="text-xl font-bold text-white font-boldpixels-medium">
                            ⬆️ Upgrade Cost
                          </ThemedText>
                          <ThemedText className="text-3xl font-bold text-blue-400 font-boldpixels-medium">
                            ✨ {item.upgradePrice}
                          </ThemedText>
                        </View>

                        {!canAffordUpgrade && (
                          <View className="mt-3 bg-red-500/20 border border-red-500/40 rounded-xl p-3">
                            <ThemedText className="text-sm text-red-300 text-center">
                              You need{' '}
                              {item.upgradePrice - currency.goldenNoteShards}{' '}
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
                              ? `⬆️ Upgrade to Lv.${item.level + 1}`
                              : '🔒 Insufficient Shards'}
                        </FlatButtonText>
                      </FlatButton>
                    </>
                  )}

                  {/* Max Level Badge */}
                  {item.level >= 10 && (
                    <View className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-5 border-4 border-yellow-400">
                      <ThemedText className="text-2xl font-bold text-center text-black font-boldpixels-medium">
                        🏆 MAX LEVEL 🏆
                      </ThemedText>
                      <ThemedText className="text-sm text-center text-black/80 mt-1">
                        This equipment is fully upgraded!
                      </ThemedText>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
