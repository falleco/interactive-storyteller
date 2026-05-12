import { router } from 'expo-router';
import type React from 'react';
import { Image, Pressable, View } from 'react-native';
import { ThemedText } from '~/shared/components/themed-text';
import { cn } from '~/shared/lib/cn';
import type { Instrument } from '~/shared/types/music';
import { InstrumentRarity } from '~/shared/types/music';
import { getInstrumentArtwork } from '~/features/instruments/utils/get-instrument-artwork';

interface InstrumentGridCardProps {
  className?: string;
  instrument: Instrument;
}

/**
 * Smaller instrument card for grid display
 *
 * Shows instrument icon, name, and key info in a compact format.
 * Tapping the card navigates to the equipment management page.
 *
 * @param instrument - The instrument data to display
 */
export function InstrumentGridCard({
  className,
  instrument,
}: InstrumentGridCardProps) {
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

  const getRarityBorderColor = () => {
    switch (instrument.rarity) {
      case InstrumentRarity.APPRENTICE:
        return 'border-gray-400';
      case InstrumentRarity.NORMAL:
        return 'border-blue-400';
      case InstrumentRarity.PRO:
        return 'border-purple-400';
      case InstrumentRarity.EPIC:
        return 'border-yellow-400';
      default:
        return 'border-gray-400';
    }
  };

  const handlePress = () => {
    // Navigate to instrument management page with instrument ID
    router.push({
      pathname: '/luthier/manage',
      params: { id: instrument.id },
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
      {instrument.isEquipped && (
        <View className="absolute top-2 right-2 z-10 bg-green-500 rounded-full px-2 py-1">
          <ThemedText className="text-xs font-bold text-white">✓</ThemedText>
        </View>
      )}

      {/* Level Badge */}
      {instrument.isOwned && (
        <View className="absolute top-2 left-2 z-10 bg-blue-500 rounded-full px-2 py-1">
          <ThemedText className="text-xs font-bold text-white">
            Lv{instrument.level}
          </ThemedText>
        </View>
      )}

      {/* Tuning Status */}
      {instrument.isOwned && instrument.tuning < 90 && (
        <View className="absolute top-2 left-2 right-2 z-10 flex-row justify-center">
          <View className="bg-orange-500 rounded-full px-2 py-1">
            <ThemedText className="text-xs font-bold text-white">
              🎵 {instrument.tuning}%
            </ThemedText>
          </View>
        </View>
      )}

      <View className="flex-col w-full h-full min-h-[160px] relative">
        {/* Icon Area */}
        <View className="flex-1 justify-center items-center pt-6 pb-2">
          {artwork ? (
            <Image
              source={artwork}
              resizeMode="contain"
              style={{ width: 96, height: 96 }}
            />
          ) : (
            <ThemedText className="text-6xl">{instrument.icon}</ThemedText>
          )}
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
            {instrument.name}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}
