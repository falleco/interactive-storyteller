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

const IPAD_BREAKPOINT = 768;

export default function GamesTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= IPAD_BREAKPOINT ? 2 : 1;

  const handleOpenGame = (id: string) => {
    router.push(`/games/${id}` as Href);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <FlatList
        key={columns}
        className="flex-1"
        data={gameLibrary}
        keyExtractor={(game) => game.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        contentContainerStyle={{
          paddingHorizontal: 20,
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
          />
        )}
      />
    </SafeAreaView>
  );
}

function GameLibraryCard({
  game,
  onPress,
}: {
  game: GameDefinition<any>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Start ${game.title}`}
      className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
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
