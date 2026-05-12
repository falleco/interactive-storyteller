import { router } from 'expo-router';
import type React from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';
import type { Equipment } from '~/shared/types/music';
import { EquipmentRarity } from '~/shared/types/music';

interface EquipmentGridCardProps {
  className?: string;
  equipment: Equipment;
}

/**
 * Smaller equipment card for grid display
 *
 * Shows equipment icon, name, and key info in a compact format.
 * Tapping the card navigates to the detailed equipment management page.
 *
 * @param equipment - The equipment data to display
 */
export function EquipmentGridCard({
  className,
  equipment,
}: EquipmentGridCardProps) {
  const textColor = useThemeColor({}, 'text');

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

  const getRarityBorderColor = () => {
    switch (equipment.rarity) {
      case EquipmentRarity.COMMON:
        return 'border-gray-400';
      case EquipmentRarity.RARE:
        return 'border-blue-400';
      case EquipmentRarity.EPIC:
        return 'border-purple-400';
      case EquipmentRarity.LEGENDARY:
        return 'border-yellow-400';
      default:
        return 'border-gray-400';
    }
  };

  const handlePress = () => {
    router.push({
      pathname: '/bag/manage',
      params: { id: equipment.id },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'rounded-2xl border-2 justify-center items-center bg-white/90 active:opacity-80 relative overflow-hidden',
        getRarityBorderColor(),
        className,
      )}
    >
      {/* Equipped Badge */}
      {equipment.isEquipped && (
        <View className="absolute top-2 right-2 z-10 bg-green-500 rounded-full px-2 py-1">
          <ThemedText className="text-xs font-bold text-white">✓</ThemedText>
        </View>
      )}

      {/* Owned Badge */}
      {equipment.isOwned && !equipment.isEquipped && (
        <View className="absolute top-2 right-2 z-10 bg-blue-500 rounded-full px-2 py-1">
          <ThemedText className="text-xs font-bold text-white">
            Lv{equipment.level}
          </ThemedText>
        </View>
      )}

      <View className="flex-col w-full h-full min-h-[160px] relative">
        {/* Icon Area */}
        <View className="flex-1 justify-center items-center pt-6 pb-2">
          <ThemedText className="text-6xl">{equipment.icon}</ThemedText>
        </View>

        {/* Name Area */}
        <View
          className="absolute bottom-0 left-0 right-0 py-2 px-2"
          style={{ backgroundColor: `${getRarityColor()}CC` }}
        >
          <ThemedText
            className="text-sm font-semibold text-center text-white font-pixelpurl-medium"
            numberOfLines={1}
          >
            {equipment.name}
          </ThemedText>

          {/* Show price if not owned */}
          {!equipment.isOwned && (
            <ThemedText className="text-xs text-center text-white/90 mt-1">
              ✨ {equipment.price}
            </ThemedText>
          )}
        </View>
      </View>
    </Pressable>
  );
}
