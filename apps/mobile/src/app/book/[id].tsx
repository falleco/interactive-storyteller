import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type BookDetail,
  BookPlayer,
  useBookDetail,
  useBooks,
} from '~/features/books';
import { ModalHeader } from '~/features/settings';
import { ThemedText } from '~/shared/components/themed-text';
import { useThemeColor } from '~/shared/hooks/use-theme-color';
import { cn } from '~/shared/lib/cn';

export default function BookDetailScreen() {
  const backgroundColor = useThemeColor({}, 'background');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { book, isLoading, error, refetch } = useBookDetail(id ?? null);
  const { completeRead, chooseNext } = useBooks();

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

  const handleChoose = async ({ choiceIndex }: { choiceIndex: number }) => {
    if (!book) return;
    try {
      await chooseNext({ bookId: book.id, choiceIndex });
    } catch (e) {
      console.warn('[book] chooseNext failed', e);
    }
    // Force an immediate refetch so the polling loop restarts now that there's
    // a new pending page coming in — otherwise we'd wait until the next idle
    // refresh to notice.
    await refetch();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <ModalHeader
        title={book ? book.title : '📖 Story'}
        onClose={handleClose}
      />

      {!book && isLoading && (
        <View className="flex-1 items-center justify-center">
          <ThemedText className="text-base text-gray-500">Loading…</ThemedText>
        </View>
      )}

      {error && !book && (
        <View className="flex-1 items-center justify-center px-6">
          <ThemedText className="text-base text-red-600 text-center">
            {error.message}
          </ThemedText>
        </View>
      )}

      {book && book.status === 'ready' && (
        <BookPlayer
          book={book}
          onComplete={handleComplete}
          onChoose={handleChoose}
        />
      )}

      {book && book.status !== 'ready' && <GeneratingView book={book} />}
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
          <View className="w-full aspect-square bg-gray-200 rounded-2xl items-center justify-center">
            <ThemedText className="text-base text-gray-500">
              {book.status === 'generating' ? 'Drawing the cover…' : 'No cover'}
            </ThemedText>
          </View>
        )}
        <ThemedText className="text-2xl font-black text-black text-center mt-4">
          {book.title}
        </ThemedText>
        <StatusBadge status={book.status} />
      </View>

      {book.pages.map((page) => (
        <View
          key={page.id}
          className="mb-6 bg-white rounded-2xl border border-gray-200 p-4"
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
            <View className="w-full aspect-square bg-gray-100 rounded-xl items-center justify-center mb-3">
              <ThemedText className="text-sm text-gray-400">
                Image coming…
              </ThemedText>
            </View>
          )}
          <ThemedText className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Page {page.pageNumber}
          </ThemedText>
          <ThemedText className="text-lg font-bold text-black mb-2">
            {page.title}
          </ThemedText>
          <ThemedText className="text-base text-black leading-6">
            {page.content}
          </ThemedText>
          {!page.audioUrl && book.status === 'generating' && (
            <ThemedText className="text-xs text-gray-400 mt-3">
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
    draft: 'bg-gray-100 text-gray-700',
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
