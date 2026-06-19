import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  type BookDetail,
  BookPlayer,
  useBookDetail,
  useBooks,
} from '~/features/books';
import { buildStoryGameSessionKey } from '~/features/games/story-game-events';
import { ModalHeader } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

export default function BookDetailScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'text');
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { book, isLoading, error, refetch } = useBookDetail(id ?? null);
  const { completeRead, completeGame } = useBooks();
  const [completedGameKey, setCompletedGameKey] = useState<string | null>(null);

  const handleClose = () => router.back();

  const handleComplete = async () => {
    if (!book) return;
    try {
      await completeRead(book.id);
    } catch (e) {
      console.warn('[book] completeRead failed', e);
    }
    router.back();
  };

  const handleCompleteGame = async ({
    page,
    game,
  }: {
    page: BookDetail['pages'][number];
    game: NonNullable<BookDetail['pages'][number]['game']>;
  }) => {
    if (!book) return;
    const gameKey = buildStoryGameSessionKey({
      bookId: book.id,
      pageId: page.id,
      gameId: game.id,
    });
    try {
      await completeGame({ bookId: book.id, pageId: page.id, gameId: game.id });
      setCompletedGameKey(gameKey);
      await refetch();
    } catch (e) {
      console.warn('[book] completeGame failed', e);
      throw e;
    }
  };

  // While the book is ready, render the player edge-to-edge — the slide's
  // pastel background should reach the device edges (under the status bar
  // and home indicator), not get capped by a white SafeAreaView. The
  // player has its own back button + page indicator that respect insets
  // internally, so there's no header to render here.
  if (book && book.status === 'ready') {
    return (
      <View className="flex-1">
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <BookPlayer
          book={book}
          onComplete={handleComplete}
          onCompleteGame={handleCompleteGame}
          completedGameKey={completedGameKey}
          onBack={handleClose}
        />
      </View>
    );
  }

  // Initial-fetch state — the book hasn't arrived yet. Render a quiet
  // full-screen splash that mirrors the player's chrome (back-chevron in
  // the corner, no header, no white safe-area band) so the transition
  // into the player feels like one continuous surface rather than
  // flashing a placeholder "📖 Story" header for a beat.
  if (!book) {
    return (
      <View className="flex-1" style={{ backgroundColor }}>
        <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 16 }}
        >
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            className="w-11 h-11 rounded-full bg-black/15 dark:bg-white/10 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={iconColor}
            />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          {error ? (
            <ThemedText className="text-base text-red-600 text-center">
              {error.message}
            </ThemedText>
          ) : isLoading ? (
            <ActivityIndicator />
          ) : null}
        </View>
      </View>
    );
  }

  // Book exists but isn't ready yet (generating / draft / failed) — keep
  // the modal header here so the user has context on the title + a close
  // affordance while the cover and pages stream in.
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <ModalHeader title={book.title} onClose={handleClose} />
      <GeneratingView book={book} />
    </SafeAreaView>
  );
}

function GeneratingView({ book }: { book: BookDetail }) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="p-5 pb-12">
      <View className="items-center mb-4">
        {book.coverImageUrl ? (
          <Image
            source={{ uri: book.coverImageUrl }}
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: 16,
            }}
            contentFit="cover"
          />
        ) : (
          <View className="w-full aspect-square bg-gray-200 dark:bg-zinc-800 rounded-2xl items-center justify-center">
            <ThemedText className="text-base text-gray-500 dark:text-zinc-400">
              {book.status === 'generating' ? 'Drawing the cover…' : 'No cover'}
            </ThemedText>
          </View>
        )}
        <ThemedText className="text-2xl font-black text-black dark:text-white text-center mt-4">
          {book.title}
        </ThemedText>
        <StatusBadge status={book.status} />
      </View>

      {book.pages.map((page) => (
        <View
          key={page.id}
          className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 p-4"
        >
          {page.imageUrl ? (
            <Image
              source={{ uri: page.imageUrl }}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: 12,
                marginBottom: 12,
              }}
              contentFit="cover"
            />
          ) : (
            <View className="w-full aspect-square bg-gray-100 dark:bg-zinc-800 rounded-xl items-center justify-center mb-3">
              <ThemedText className="text-sm text-gray-400 dark:text-zinc-500">
                Image coming…
              </ThemedText>
            </View>
          )}
          <ThemedText className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-1">
            Page {page.pageNumber}
          </ThemedText>
          <ThemedText className="text-lg font-bold text-black dark:text-white mb-2">
            {page.title}
          </ThemedText>
          <ThemedText className="text-base text-black dark:text-white leading-6">
            {page.content}
          </ThemedText>
          {!page.audioUrl && book.status === 'generating' && (
            <ThemedText className="text-xs text-gray-400 dark:text-zinc-500 mt-3">
              Narration loading…
            </ThemedText>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    generating: 'bg-amber-100 text-amber-900',
    ready: 'bg-emerald-100 text-emerald-900',
    failed: 'bg-red-100 text-red-900',
    draft: 'bg-gray-100 dark:bg-zinc-800 text-gray-700',
  };
  const colors = palette[status] ?? palette.draft;
  const [bg, text] = colors.split(' ');
  return (
    <View className={cn('mt-2 px-3 py-1 rounded-full', bg)}>
      <ThemedText className={cn('text-xs font-semibold', text)}>
        {status === 'generating'
          ? '✨ Generating…'
          : status === 'ready'
            ? '✅ Ready'
            : status === 'failed'
              ? '⚠️ Failed'
              : status}
      </ThemedText>
    </View>
  );
}
