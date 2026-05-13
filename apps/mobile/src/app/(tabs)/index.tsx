import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { type BookSummary, useBooks } from '~/features/books';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

export default function HomeTab() {
  const backgroundColor = useThemeColor({}, 'background');
  const { user } = useAuth();
  const { books, isLoading, error, refresh, remove } = useBooks();

  const insets = useSafeAreaInsets();

  // Refetch on focus — the wizard modal mounts its own useBooks instance, so
  // the create there doesn't reach this tab's state once we return.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleCreate = () => router.push('/imagine' as Href);
  const handleOpenBook = (id: string) => router.push(`/book/${id}` as Href);

  const handleDeleteBook = (id: string, title: string) => {
    Alert.alert('Delete story', `Remove "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(id);
          } catch (e) {
            Alert.alert(
              'Failed',
              e instanceof Error ? e.message : 'Could not delete',
            );
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <View className="px-5 pt-2 pb-1">
        <ThemedText className="text-2xl font-black text-black">
          Wonder Tales
        </ThemedText>
      </View>

      {!user ? (
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-gray-500 text-center">
            Sign in from the Settings tab to start creating stories.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 220,
          }}
          data={books}
          keyExtractor={(b) => b.id}
          refreshing={isLoading}
          onRefresh={refresh}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            !isLoading ? (
              <View className="items-center mt-16 px-6">
                <ThemedText className="text-base text-gray-500 text-center">
                  {error
                    ? `Couldn't load: ${error.message}`
                    : 'No stories yet. Tap "New story" to get started.'}
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onPress={() => handleOpenBook(item.id)}
              onLongPress={() => handleDeleteBook(item.id, item.title)}
            />
          )}
        />
      )}

      {user && (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-6"
          style={{ bottom: insets.bottom + 120 }}
        >
          <FlatButton size="lg" className="bg-black" onPress={handleCreate}>
            <ThemedText className="text-base font-semibold text-white">
              ✨ New story
            </ThemedText>
          </FlatButton>
        </View>
      )}
    </SafeAreaView>
  );
}

function BookCard({
  book,
  onPress,
  onLongPress,
}: {
  book: BookSummary;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-1 bg-white rounded-2xl border border-gray-200 p-2"
    >
      {book.coverImageUrl ? (
        <Image
          source={{ uri: book.coverImageUrl }}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="w-full aspect-square bg-gray-100 rounded-xl items-center justify-center">
          <ThemedText className="text-2xl">📖</ThemedText>
        </View>
      )}
      <ThemedText
        numberOfLines={2}
        className="text-sm font-bold text-black mt-2"
      >
        {book.title}
      </ThemedText>
      <View
        className={cn(
          'mt-1 self-start px-2 py-0.5 rounded-full',
          book.status === 'ready'
            ? 'bg-emerald-100'
            : book.status === 'generating'
              ? 'bg-amber-100'
              : book.status === 'failed'
                ? 'bg-red-100'
                : 'bg-gray-100',
        )}
      >
        <ThemedText
          className={cn(
            'text-[10px] font-semibold',
            book.status === 'ready'
              ? 'text-emerald-900'
              : book.status === 'generating'
                ? 'text-amber-900'
                : book.status === 'failed'
                  ? 'text-red-900'
                  : 'text-gray-700',
          )}
        >
          {book.status === 'ready'
            ? 'READY'
            : book.status === 'generating'
              ? 'GENERATING'
              : book.status.toUpperCase()}
        </ThemedText>
      </View>
    </Pressable>
  );
}
