import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { GameDefinition } from '~/features/games';
import { gameLibrary } from '~/features/games';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';

const GAME_COLUMNS = 2;

export default function GamesTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = 16;
  const cardGap = 12;
  const cardWidth =
    (width - horizontalPadding * 2 - cardGap * (GAME_COLUMNS - 1)) /
    GAME_COLUMNS;

  const handleOpenGame = (id: string) => {
    router.push(`/games/${id}` as Href);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <FlatList
        key={GAME_COLUMNS}
        className="flex-1"
        data={gameLibrary}
        keyExtractor={(game) => game.id}
        numColumns={GAME_COLUMNS}
        columnWrapperStyle={{ gap: cardGap }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: 12,
          paddingBottom: insets.bottom + 220,
        }}
        ListHeaderComponent={
          <View className="mb-4 gap-2">
            <ThemedText className="text-2xl font-black text-black dark:text-white">
              Games
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <GameLibraryCard
            game={item}
            onPress={() => handleOpenGame(item.id)}
            width={cardWidth}
          />
        )}
      />
    </SafeAreaView>
  );
}

function GameLibraryCard({
  game,
  onPress,
  width,
}: {
  game: GameDefinition<any>;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Start ${game.title}`}
      className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      style={{ width }}
    >
      <Image
        source={game.cardImage}
        style={{ width: '100%', aspectRatio: 1 }}
        contentFit="cover"
      />
      <View className="min-h-16 justify-center px-4 py-3">
        <ThemedText className="text-xl font-black text-black dark:text-white">
          {game.title}
        </ThemedText>
      </View>
    </Pressable>
  );
}
