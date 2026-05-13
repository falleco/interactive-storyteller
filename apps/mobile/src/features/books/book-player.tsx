import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { FlatButton } from '~/shared/components/core/flat-button';
import { ThemedText } from '~/shared/components/themed-text';
import { cn } from '~/shared/lib/cn';
import {
  type BookChoice,
  type BookDetail,
  type BookPagePayload,
  STORY_PAGE_COUNT,
} from './types';
import { useBookAudio } from './use-book-audio';

interface BookPlayerProps {
  book: BookDetail;
  /** Called when the user finishes reading (taps "I'm done" on the last slide). */
  onComplete?: () => Promise<void> | void;
  /**
   * Called when the user picks a choice on an interactive page. Should kick
   * off the next-page generation on the backend; once the new page is
   * persisted, the book detail polling will surface it and slides will
   * progress automatically.
   */
  onChoose?: (input: { choiceIndex: number }) => Promise<void> | void;
}

type Slide =
  | { kind: 'cover' }
  | { kind: 'page'; page: BookPagePayload }
  | { kind: 'choices'; page: BookPagePayload }
  | { kind: 'loading-next'; afterPageNumber: number }
  | { kind: 'end' };

export function BookPlayer({ book, onComplete, onChoose }: BookPlayerProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(
    null,
  );

  const slides = useMemo<Slide[]>(() => buildSlides(book), [book]);

  const currentSlide = slides[index];
  const audioSource = useMemo(() => {
    if (currentSlide?.kind === 'cover') return book.titleAudioUrl;
    if (currentSlide?.kind === 'page') return currentSlide.page.audioUrl;
    return null;
  }, [currentSlide, book.titleAudioUrl]);

  const advance = useCallback(() => {
    setIndex((prev) => {
      const next = Math.min(prev + 1, slides.length - 1);
      if (next !== prev) {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      }
      return next;
    });
  }, [slides.length]);

  const audio = useBookAudio({
    source: audioSource,
    autoPlay: true,
    onComplete: () => {
      // When narration finishes, gently advance to the next slide.
      advance();
    },
  });

  // Keep listRef in sync with state if user scrolls.
  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      setIndex(next);
    }
  };

  // Reset audio when book changes entirely.
  useEffect(() => {
    setIndex(0);
    listRef.current?.scrollToIndex({ index: 0, animated: false });
  }, []);

  const handleFinish = useCallback(async () => {
    if (!onComplete) return;
    setIsFinishing(true);
    try {
      await onComplete();
    } finally {
      setIsFinishing(false);
    }
  }, [onComplete]);

  const handlePickChoice = useCallback(
    async (choiceIndex: number) => {
      if (!onChoose || pendingChoiceIndex !== null) return;
      setPendingChoiceIndex(choiceIndex);
      try {
        await onChoose({ choiceIndex });
      } finally {
        setPendingChoiceIndex(null);
      }
    },
    [onChoose, pendingChoiceIndex],
  );

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={slides}
        keyExtractor={(slide, i) => slideKey(slide, i)}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item }) => {
          if (item.kind === 'cover') {
            return (
              <CoverSlide
                width={width}
                imageUrl={book.coverImageUrl}
                title={book.title}
              />
            );
          }
          if (item.kind === 'end') {
            return (
              <EndSlide
                width={width}
                isFinishing={isFinishing}
                onFinish={handleFinish}
              />
            );
          }
          if (item.kind === 'choices') {
            return (
              <ChoicesSlide
                width={width}
                choices={item.page.choices}
                pendingChoiceIndex={pendingChoiceIndex}
                onPick={handlePickChoice}
              />
            );
          }
          if (item.kind === 'loading-next') {
            return <LoadingNextSlide width={width} />;
          }
          return <PageSlide width={width} page={item.page} />;
        }}
      />

      <View className="absolute bottom-12 left-0 right-0 items-center">
        <PageIndicator current={index} total={slides.length} />
        <View className="mt-3">
          <Pressable
            disabled={!audio.hasSource}
            onPress={audio.toggle}
            className={cn(
              'w-16 h-16 rounded-full items-center justify-center',
              audio.hasSource ? 'bg-black' : 'bg-gray-300 dark:bg-zinc-600',
            )}
          >
            <ThemedText className="text-white text-2xl">
              {audio.isLoading ? '…' : audio.isPlaying ? '⏸' : '▶'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CoverSlide({
  width,
  imageUrl,
  title,
}: {
  width: number;
  imageUrl: string | null;
  title: string;
}) {
  return (
    <View style={{ width }} className="px-6 pt-4 items-center">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 24,
          }}
          contentFit="cover"
        />
      ) : (
        <View className="w-full aspect-square bg-gray-200 dark:bg-zinc-700 rounded-3xl items-center justify-center">
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400">
            No cover
          </ThemedText>
        </View>
      )}
      <ThemedText className="text-3xl font-black text-black dark:text-white text-center mt-6">
        {title}
      </ThemedText>
    </View>
  );
}

function PageSlide({ width, page }: { width: number; page: BookPagePayload }) {
  return (
    <View style={{ width }} className="px-6 pt-4">
      {page.imageUrl ? (
        <Image
          source={{ uri: page.imageUrl }}
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 24,
          }}
          contentFit="cover"
        />
      ) : (
        <View className="w-full aspect-square bg-gray-100 dark:bg-zinc-800 rounded-3xl items-center justify-center">
          <ThemedText className="text-sm text-gray-400 dark:text-zinc-500">
            Image coming…
          </ThemedText>
        </View>
      )}
      <View className="mt-4">
        <ThemedText className="text-xs uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-1">
          Page {page.pageNumber}
        </ThemedText>
        <ThemedText className="text-xl font-black text-black dark:text-white mb-2">
          {page.title}
        </ThemedText>
        <ThemedText className="text-base text-black dark:text-white leading-7">
          {page.content}
        </ThemedText>
      </View>
    </View>
  );
}

function EndSlide({
  width,
  isFinishing,
  onFinish,
}: {
  width: number;
  isFinishing: boolean;
  onFinish: () => void;
}) {
  return (
    <View style={{ width }} className="px-6 pt-12 items-center">
      <ThemedText className="text-5xl mb-4">🎉</ThemedText>
      <ThemedText className="text-3xl font-black text-black dark:text-white text-center">
        The end
      </ThemedText>
      <ThemedText className="text-base text-gray-600 dark:text-zinc-400 text-center mt-2 mb-8">
        Hope you enjoyed the story.
      </ThemedText>
      <FlatButton
        size="lg"
        className="bg-black"
        isDisabled={isFinishing}
        onPress={onFinish}
      >
        <ThemedText className="text-base font-semibold text-white">
          {isFinishing ? 'Saving…' : 'I finished reading'}
        </ThemedText>
      </FlatButton>
    </View>
  );
}

function ChoicesSlide({
  width,
  choices,
  pendingChoiceIndex,
  onPick,
}: {
  width: number;
  choices: BookChoice[];
  pendingChoiceIndex: number | null;
  onPick: (choiceIndex: number) => void;
}) {
  return (
    <View style={{ width }} className="px-6 pt-6">
      <ThemedText className="text-2xl font-black text-black dark:text-white text-center mb-4">
        What happens next?
      </ThemedText>
      <View className="gap-3">
        {choices.map((choice) => {
          const isPending = pendingChoiceIndex === choice.choiceIndex;
          const isDisabled = pendingChoiceIndex !== null;
          return (
            <Pressable
              key={choice.id}
              disabled={isDisabled}
              onPress={() => onPick(choice.choiceIndex)}
              className={cn(
                'bg-white border rounded-2xl overflow-hidden',
                isPending ? 'border-black' : 'border-gray-200',
                isDisabled && !isPending && 'opacity-50',
              )}
            >
              {choice.imageUrl ? (
                <Image
                  source={{ uri: choice.imageUrl }}
                  style={{ width: '100%', aspectRatio: 16 / 9 }}
                  contentFit="cover"
                />
              ) : (
                <View className="w-full aspect-[16/9] bg-gray-100 dark:bg-zinc-800 items-center justify-center">
                  <ThemedText className="text-xs text-gray-400 dark:text-zinc-500">
                    Drawing…
                  </ThemedText>
                </View>
              )}
              <View className="px-4 py-3">
                <ThemedText className="text-base font-semibold text-black dark:text-white">
                  {choice.label}
                </ThemedText>
                {isPending && (
                  <ThemedText className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Writing the next page…
                  </ThemedText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LoadingNextSlide({ width }: { width: number }) {
  return (
    <View style={{ width }} className="px-6 pt-24 items-center">
      <ThemedText className="text-5xl mb-4">✨</ThemedText>
      <ThemedText className="text-2xl font-black text-black dark:text-white text-center">
        Writing the next page…
      </ThemedText>
      <ThemedText className="text-sm text-gray-500 dark:text-zinc-400 text-center mt-2">
        Hold tight, we're imagining what comes next.
      </ThemedText>
    </View>
  );
}

function PageIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: dots have no identity beyond position
          key={`dot-${i}`}
          className={cn(
            'h-1.5 rounded-full',
            i === current
              ? 'w-6 bg-black'
              : 'w-1.5 bg-gray-300 dark:bg-zinc-600',
          )}
        />
      ))}
    </View>
  );
}

function buildSlides(book: BookDetail): Slide[] {
  const slides: Slide[] = [{ kind: 'cover' }];
  const isInteractive = book.mode === 'interactive';

  book.pages.forEach((page, idx) => {
    slides.push({ kind: 'page', page });

    const isLastExisting = idx === book.pages.length - 1;
    if (!isInteractive || !isLastExisting) return;

    if (page.pageNumber >= STORY_PAGE_COUNT) return; // end will be added below

    const hasSelected = page.choices.some((c) => c.selected);
    if (hasSelected) {
      slides.push({ kind: 'loading-next', afterPageNumber: page.pageNumber });
    } else if (page.choices.length > 0) {
      slides.push({ kind: 'choices', page });
    }
  });

  const lastPage = book.pages[book.pages.length - 1];
  const storyComplete =
    !isInteractive ||
    (lastPage !== undefined && lastPage.pageNumber >= STORY_PAGE_COUNT);
  if (storyComplete) {
    slides.push({ kind: 'end' });
  }

  return slides;
}

function slideKey(slide: Slide, index: number): string {
  switch (slide.kind) {
    case 'cover':
      return 'cover';
    case 'page':
      return `p-${slide.page.id}`;
    case 'choices':
      return `c-${slide.page.id}`;
    case 'loading-next':
      return `ln-${slide.afterPageNumber}`;
    case 'end':
      return `end-${index}`;
  }
}
