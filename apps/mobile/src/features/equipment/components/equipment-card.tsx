import type React from 'react';
import { Alert, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import type { Equipment, UserCurrency } from '~/shared/types/music';
import { EquipmentRarity } from '~/shared/types/music';

interface EquipmentCardProps {
  equipment: Equipment;
  currency: UserCurrency;
  onBuy: (equipmentId: string) => Promise<boolean>;
  onUpgrade: (equipmentId: string) => Promise<boolean>;
  onEquip: (equipmentId: string) => Promise<void>;
  onUnequip: (equipmentId: string) => Promise<void>;
  /** Hide buy/upgrade buttons (for instruments that must be purchased at luthier) */
  hidePurchaseActions?: boolean;
}

/**
 * Equipment card component for displaying equipment items
 *
 * Shows equipment details, stats, and available actions based on ownership status.
 * Handles purchasing, upgrading, equipping, and unequipping equipment.
 *
 * @param equipment - The equipment data to display
 * @param currency - Current user currency
 * @param onBuy - Callback when user buys equipment
 * @param onUpgrade - Callback when user upgrades equipment
 * @param onEquip - Callback when user equips equipment
 * @param onUnequip - Callback when user unequips equipment
 */
export function EquipmentCard({
  equipment,
  currency,
  onBuy,
  onUpgrade,
  onEquip,
  onUnequip,
  hidePurchaseActions = false,
}: EquipmentCardProps) {
  const cardBackgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const getRarityColor = () => {
    switch (equipment.rarity) {
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

  const handleBuyPress = async () => {
    if (currency.goldenNoteShards < equipment.price) {
      Alert.alert(
        'Insufficient Funds',
        `You need ${equipment.price} golden note shards to buy this equipment.`,
        [{ text: 'OK' }],
      );
      return;
    }

    const success = await onBuy(equipment.id);
    if (success) {
      Alert.alert(
        'Purchase Successful!',
        `You have successfully purchased ${equipment.name}!`,
        [{ text: 'Great!' }],
      );
    }
  };

  const handleUpgradePress = async () => {
    if (currency.goldenNoteShards < equipment.upgradePrice) {
      Alert.alert(
        'Insufficient Funds',
        `You need ${equipment.upgradePrice} golden note shards to upgrade this equipment.`,
        [{ text: 'OK' }],
      );
      return;
    }

    const success = await onUpgrade(equipment.id);
    if (success) {
      Alert.alert(
        'Upgrade Successful!',
        `${equipment.name} has been upgraded to level ${equipment.level + 1}!`,
        [{ text: 'Excellent!' }],
      );
    }
  };

  const handleEquipPress = async () => {
    await onEquip(equipment.id);
  };

  const handleUnequipPress = async () => {
    await onUnequip(equipment.id);
  };

  return (
    <View
      className="mb-3 p-4 rounded-xl border border-gray-200"
      style={{ backgroundColor: cardBackgroundColor }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <ThemedText className="text-2xl mr-3">{equipment.icon}</ThemedText>
          <View className="flex-1">
            <ThemedText
              className="text-lg font-semibold"
              style={{ color: textColor }}
            >
              {equipment.name}
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
                  {equipment.rarity}
                </ThemedText>
              </View>
              <ThemedText
                className="text-xs"
                style={{ color: secondaryTextColor }}
              >
                Level {equipment.level}
              </ThemedText>
              {equipment.isEquipped && (
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
        {equipment.description}
      </ThemedText>

      {/* Stats */}
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-1">
          <ThemedText className="text-sm" style={{ color: secondaryTextColor }}>
            Score Bonus
          </ThemedText>
          <ThemedText
            className="text-sm font-medium"
            style={{ color: primaryColor }}
          >
            +{equipment.bonuses.scoreBonus}
          </ThemedText>
        </View>

        <View className="flex-row justify-between items-center mb-1">
          <ThemedText className="text-sm" style={{ color: secondaryTextColor }}>
            Accuracy Bonus
          </ThemedText>
          <ThemedText
            className="text-sm font-medium"
            style={{ color: primaryColor }}
          >
            +{equipment.bonuses.accuracyBonus}%
          </ThemedText>
        </View>

        <View className="flex-row justify-between items-center mb-1">
          <ThemedText className="text-sm" style={{ color: secondaryTextColor }}>
            Streak Bonus
          </ThemedText>
          <ThemedText
            className="text-sm font-medium"
            style={{ color: primaryColor }}
          >
            +{equipment.bonuses.streakBonus}
          </ThemedText>
        </View>

        {equipment.bonuses.specialEffect && (
          <View className="mt-2 p-2 bg-blue-50 rounded-lg">
            <ThemedText className="text-xs font-medium text-blue-800">
              ✨ {equipment.bonuses.specialEffect}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View className="flex-row space-x-2">
        {!equipment.isOwned && !hidePurchaseActions && (
          <Button
            size="sm"
            variant="solid"
            onPress={handleBuyPress}
            isDisabled={currency.goldenNoteShards < equipment.price}
            className="flex-1"
          >
            <ButtonText>Buy - ✨{equipment.price}</ButtonText>
          </Button>
        )}

        {!equipment.isOwned && hidePurchaseActions && (
          <View className="flex-1 p-2 bg-amber-50 rounded-lg">
            <ThemedText className="text-xs text-amber-800 text-center">
              Visit the Luthier to purchase
            </ThemedText>
          </View>
        )}

        {equipment.isOwned && !equipment.isEquipped && (
          <Button
            size="sm"
            variant="solid"
            onPress={handleEquipPress}
            className="flex-1"
          >
            <ButtonText>Equip</ButtonText>
          </Button>
        )}

        {equipment.isOwned && equipment.isEquipped && (
          <Button
            size="sm"
            variant="outline"
            onPress={handleUnequipPress}
            className="flex-1"
          >
            <ButtonText>Unequip</ButtonText>
          </Button>
        )}

        {equipment.isOwned && equipment.level < 10 && !hidePurchaseActions && (
          <Button
            size="sm"
            variant="outline"
            onPress={handleUpgradePress}
            isDisabled={currency.goldenNoteShards < equipment.upgradePrice}
            className="flex-1"
          >
            <ButtonText>Upgrade - ✨{equipment.upgradePrice}</ButtonText>
          </Button>
        )}
      </View>
    </View>
  );
}
