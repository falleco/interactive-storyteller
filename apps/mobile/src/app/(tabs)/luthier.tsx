import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useState } from 'react';
import {
  Alert,
  type DimensionValue,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCurrency } from '~/features/currency';
import { InstrumentGridCard } from '~/features/instruments';
import { LuthierCard, useLuthier } from '~/features/luthier';
import {
  FlatButton,
  FlatButtonText,
} from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { Button, ButtonText } from '~/shared/components/ui/gluestack-button';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

export default function LuthierTab() {
  const textColor = useThemeColor({}, 'text');
  const secondaryTextColor = useThemeColor({}, 'tabIconDefault');
  const primaryColor = useThemeColor({}, 'tint');

  const { currency, addGoldenShards } = useCurrency();
  const {
    instruments,
    equippedInstrument,
    ownedInstruments,
    buyInstrument,
    upgradeInstrument,
    tuneInstrument,
    equipInstrument,
    resetInstruments,
  } = useLuthier();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory'>('inventory');

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleBuyInstrument = async (
    instrumentId: string,
  ): Promise<boolean> => {
    return await buyInstrument(instrumentId, currency, async (newCurrency) => {
      await addGoldenShards(
        newCurrency.goldenNoteShards - currency.goldenNoteShards,
      );
    });
  };

  const handleUpgradeInstrument = async (
    instrumentId: string,
  ): Promise<boolean> => {
    return await upgradeInstrument(
      instrumentId,
      currency,
      async (newCurrency) => {
        await addGoldenShards(
          newCurrency.goldenNoteShards - currency.goldenNoteShards,
        );
      },
    );
  };

  const handleTuneInstrument = async (
    instrumentId: string,
  ): Promise<boolean> => {
    return await tuneInstrument(instrumentId, currency, async (newCurrency) => {
      await addGoldenShards(
        newCurrency.goldenNoteShards - currency.goldenNoteShards,
      );
    });
  };

  const handleEquipInstrument = async (instrumentId: string) => {
    await equipInstrument(instrumentId);
  };

  const handleResetInstruments = async () => {
    Alert.alert(
      'Reset Instruments',
      'This will reset all instruments to default state. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetInstruments();
          },
        },
      ],
    );
  };

  const availableInstruments = instruments.filter((i) => !i.isOwned);
  const canAffordAny = availableInstruments.some(
    (i) => currency.goldenNoteShards >= i.price,
  );

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
        <ThemedText
          type="title"
          className="text-6xl mb-4 font-bold self-center font-boldpixels-medium text-white"
        >
          Luthier
        </ThemedText>
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-24"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Header */}
          <View className="px-5">
            {/* Tab Navigation */}
            <View className="flex-row w-full gap-2 m-0 p-0 -mb-[3px] border-black/20 z-40">
              <FlatButton
                size="sm"
                className={cn(
                  'flex-1 bg-[#2a0f3d] border-2 border-b-0 border-white/20 rounded-b-none z-999',
                  activeTab === 'inventory' ? '' : 'border-b-2',
                )}
                onPress={() => setActiveTab('inventory')}
              >
                <FlatButtonText
                  className={cn(
                    ' text-center font-boldpixels-medium text-white',
                    activeTab === 'inventory' ? 'color-orange-400' : '',
                  )}
                >
                  My Instruments
                </FlatButtonText>
              </FlatButton>
              <FlatButton
                size="sm"
                className={cn(
                  'flex-1 bg-[#2a0f3d] border-t-2 border-l-2 border-r-2 border-b-0 border-white/20 rounded-b-none',
                  activeTab === 'shop' ? '' : 'border-b-2',
                )}
                onPress={() => setActiveTab('shop')}
              >
                <FlatButtonText
                  className={cn(
                    'text-center font-boldpixels-medium text-white',
                    activeTab === 'shop' ? 'color-orange-400' : '',
                  )}
                >
                  Shop
                </FlatButtonText>
              </FlatButton>
            </View>
          </View>

          {/* Content based on active tab */}
          <View className="mx-5 px-4 my-0 bg-[#2a0f3d] rounded-2xl rounded-tl-none z-0 border-2 border-white/20 pt-4 pb-4 justify-center items-center relative">
            {activeTab === 'inventory' && (
              <View className="w-full">
                {ownedInstruments.length === 0 ? (
                  <View className="py-8 items-center">
                    <ThemedText className="text-6xl mb-4">🎻</ThemedText>
                    <ThemedText className="text-lg font-semibold mb-2 text-white">
                      No Instruments Yet
                    </ThemedText>
                    <ThemedText className="text-sm text-center text-white/60">
                      Visit the shop to purchase your first instrument!
                    </ThemedText>
                    <FlatButton
                      size="xl"
                      onPress={() => setActiveTab('shop')}
                      className="w-full text-center rounded-2xl py-1 px-0 mt-4 border-red-400 bg-red-800 text-[#ffffff] border-4"
                    >
                      <FlatButtonText className="w-full text-2xl text-[#ffffff] font-boldpixels-medium text-center">
                        Browse Shop
                      </FlatButtonText>
                    </FlatButton>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-3 w-full">
                    {ownedInstruments.map((instrument) => (
                      <InstrumentGridCard
                        key={instrument.id}
                        instrument={instrument}
                        className="w-[47%] h-[180px]"
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeTab === 'shop' && (
              <View className="flex-1">
                {!canAffordAny && (
                  <View className="p-4 mb-4 rounded-xl bg-yellow-50 border border-yellow-200">
                    <ThemedText className="text-sm font-medium text-yellow-800 mb-1">
                      💡 Need More Shards?
                    </ThemedText>
                    <ThemedText className="text-xs text-yellow-700">
                      Complete challenges to earn golden note shards and unlock
                      these instruments!
                    </ThemedText>
                  </View>
                )}

                {availableInstruments.length === 0 ? (
                  <View className="p-8 items-center">
                    <ThemedText className="text-6xl mb-4">🏆</ThemedText>
                    <ThemedText
                      className="text-lg font-semibold mb-2"
                      style={{ color: textColor }}
                    >
                      Collection Complete!
                    </ThemedText>
                    <ThemedText
                      className="text-sm text-center"
                      style={{ color: secondaryTextColor }}
                    >
                      You own all available instruments. Check back later for
                      new additions!
                    </ThemedText>
                  </View>
                ) : (
                  <View>
                    <View className="flex-row flex-wrap w-full gap-3 relative">
                      {availableInstruments.map((instrument) => (
                        <LuthierCard
                          className="w-[47%]"
                          key={instrument.id}
                          instrument={instrument}
                          currency={currency}
                          onBuy={handleBuyInstrument}
                          onUpgrade={handleUpgradeInstrument}
                          onTune={handleTuneInstrument}
                          onEquip={handleEquipInstrument}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
          {/* Bottom Spacing */}
          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
