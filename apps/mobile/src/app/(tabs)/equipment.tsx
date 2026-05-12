import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrency } from '~/features/currency';
import { EquipmentGridCard, useEquipment } from '~/features/equipment';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { EquipmentCategory } from '~/shared/types/music';

export default function EquipmentTab() {
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const { currency, addGoldenShards } = useCurrency();
  const { getEquipmentByCategory, getTotalBonuses, resetEquipment } =
    useEquipment();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleResetEquipment = async () => {
    Alert.alert(
      'Reset Equipment',
      'This will reset all equipment to default state. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetEquipment();
          },
        },
      ],
    );
  };

  const totalBonuses = getTotalBonuses();

  // Get equipment for each category
  const mantles = getEquipmentByCategory(EquipmentCategory.MANTLE);
  const adornments = getEquipmentByCategory(EquipmentCategory.ADORNMENTS);
  const instruments = getEquipmentByCategory(EquipmentCategory.INSTRUMENTS);

  return (
    <>
      <LinearGradient
        colors={['#1B1B3C', '#E8B023']}
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
        <View className="px-5 pt-4 flex-row items-center justify-center mb-2">
          <ThemedText className="text-6xl font-bold font-boldpixels-medium text-white">
            Equipment
          </ThemedText>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-24"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Header */}
          <View className="px-5 pb-3">
            <View className="flex-row justify-center gap-4 my-4">
              {/* Total Bonuses Display */}
              <View className="p-4 rounded-xl bg-[#2a0f3d] border-2 border-white/20 mb-4 h-full">
                <ThemedText className="text-lg font-bold text-white mb-2 font-boldpixels-medium">
                  ⚡ Total Equipment Bonuses
                </ThemedText>
                <View className="flex-row justify-between">
                  <View className="items-center">
                    <ThemedText className="text-2xl font-bold text-orange-400 font-boldpixels-medium">
                      +{totalBonuses.scoreBonus}
                    </ThemedText>
                    <ThemedText className="text-xs text-white/80">
                      Score
                    </ThemedText>
                  </View>
                  <View className="items-center">
                    <ThemedText className="text-2xl font-bold text-green-400 font-boldpixels-medium">
                      +{totalBonuses.accuracyBonus}%
                    </ThemedText>
                    <ThemedText className="text-xs text-white/80">
                      Accuracy
                    </ThemedText>
                  </View>
                  <View className="items-center">
                    <ThemedText className="text-2xl font-bold text-red-400 font-boldpixels-medium">
                      +{totalBonuses.streakBonus}
                    </ThemedText>
                    <ThemedText className="text-xs text-white/80">
                      Streak
                    </ThemedText>
                  </View>
                </View>
              </View>

              <View className="bg-[#2a0f3d] rounded-2xl px-4 py-3 shadow-lg  justify-center">
                <View className="flex-row items-center">
                  <ThemedText className="text-3xl">✨</ThemedText>
                  <ThemedText className="text-3xl font-boldpixels-medium text-orange-400">
                    {currency.goldenNoteShards}
                  </ThemedText>
                </View>
                <ThemedText className="text-xs text-white/60 text-center mt-1">
                  Golden Shards
                </ThemedText>
              </View>
            </View>

            {/* Mantles Section */}
            <ThemedText className="text-2xl font-bold mb-3 text-white font-boldpixels-medium">
              🧙‍♂️ Mantles ({mantles.length})
            </ThemedText>

            {mantles.length === 0 ? (
              <View className="p-6 bg-[#2a0f3d] border-2 border-white/20 rounded-2xl mb-4 items-center">
                <ThemedText className="text-4xl mb-2">🧙‍♂️</ThemedText>
                <ThemedText className="text-sm text-white/60 text-center">
                  No mantles available yet
                </ThemedText>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3 mb-6">
                {mantles.map((item) => (
                  <EquipmentGridCard
                    key={item.id}
                    equipment={item}
                    className="w-[47%] h-[180px]"
                  />
                ))}
              </View>
            )}

            {/* Adornments Section */}
            <ThemedText className="text-2xl font-bold mb-3 text-white font-boldpixels-medium">
              💎 Adornments ({adornments.length})
            </ThemedText>

            {adornments.length === 0 ? (
              <View className="p-6 bg-[#2a0f3d] border-2 border-white/20 rounded-2xl mb-4 items-center">
                <ThemedText className="text-4xl mb-2">💎</ThemedText>
                <ThemedText className="text-sm text-white/60 text-center">
                  No adornments available yet
                </ThemedText>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3 mb-6">
                {adornments.map((item) => (
                  <EquipmentGridCard
                    key={item.id}
                    equipment={item}
                    className="w-[47%] h-[180px]"
                  />
                ))}
              </View>
            )}

            {/* Instruments Section */}
            <ThemedText className="text-2xl font-bold mb-3 text-white font-boldpixels-medium">
              🎻 Instruments ({instruments.length})
            </ThemedText>

            {instruments.length === 0 ? (
              <View className="p-6 bg-[#2a0f3d] border-2 border-white/20 rounded-2xl mb-4 items-center">
                <ThemedText className="text-4xl mb-2">🎻</ThemedText>
                <ThemedText className="text-sm text-white/60 text-center">
                  No instruments available yet. Visit the Luthier!
                </ThemedText>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3 mb-6">
                {instruments.map((item) => (
                  <EquipmentGridCard
                    key={item.id}
                    equipment={item}
                    className="w-[47%] h-[180px]"
                  />
                ))}
              </View>
            )}
          </View>

          {/* Debug Section */}
          {__DEV__ && (
            <View className="p-5 mt-5 border-t border-gray-200">
              <ThemedText className="text-lg font-bold mb-3 text-white">
                Debug Actions
              </ThemedText>
              <View className="flex-row space-x-2">
                <Button
                  variant="outline"
                  onPress={handleResetEquipment}
                  className="flex-1"
                >
                  <ButtonText className="text-white">
                    Reset Equipment
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => addGoldenShards(100)}
                  className="flex-1"
                >
                  <ButtonText className="text-white">Add 100 Shards</ButtonText>
                </Button>
              </View>
            </View>
          )}

          {/* Bottom Spacing */}
          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
