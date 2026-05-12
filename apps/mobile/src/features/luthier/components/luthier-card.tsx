import { router } from 'expo-router';
import type React from 'react';
import { Image, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
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
export function LuthierCard({
  style,
  className,
  instrument,
  currency,
  onBuy,
  onUpgrade,
  onTune,
  onEquip,
}: InstrumentCardProps) {
  const handlePress = () => {
    router.push({
      pathname: '/luthier/purchase',
      params: { id: instrument.id },
    });
  };
  const artwork = getInstrumentArtwork(instrument);

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        ' rounded-2xl border-2 border-gray-200 justify-center items-center bg-white active:opacity-80',
        className,
      )}
      style={{ ...(style ?? {}) }}
    >
      <View className="flex-row  justify-center items-center">
        <View className="flex-col flex-1 relative  flex-grow-1 h-full min-h-[150px] ">
          <View className="flex-1 justify-center items-center pb-6">
            {artwork ? (
              <Image
                source={artwork}
                resizeMode="contain"
                style={{ width: 96, height: 96 }}
              />
            ) : (
              <ThemedText className="text-6xl mr-3">
                {instrument.icon}
              </ThemedText>
            )}
          </View>
          <View className="flex-1 absolute bottom-[-2px] left-[-2px] right-[-2px] bg-black/80 rounded-b-xl">
            <ThemedText className="text-2xl font-semibold text-center text-white font-pixelpurl-medium">
              {instrument.name}
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
