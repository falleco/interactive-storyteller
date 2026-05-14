import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatButton } from '~/shared/components/core/flat-button';
import { Slider } from '~/shared/components/core/liquid-swipe';
import { ThemedText } from '~/shared/components/themed-text';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { cn } from '~/shared/lib/cn';
import { NarratedText } from './narrated-text';
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
  /**
   * Tap-back from the player's own back button. The host screen is also
   * free to render its own header — this is a redundant exit affordance
   * that's always visible over the slide content.
   */
  onBack?: () => void;
}

type Slide =
  | { kind: 'cover' }
  | { kind: 'page'; page: BookPagePayload }
  | { kind: 'choices'; page: BookPagePayload }
  | { kind: 'loading-next'; afterPageNumber: number }
  | { kind: 'end' };

/**
 * Pastel backdrop picked per slide so the wave has something colourful to
 * reveal — keeps each page-turn visually distinct for the kids reading
 * along. Kept here (not in the Slider) because the colour is data-driven
 * by the slide kind, not a generic prop of the swipe primitive. Dark
 * tones keep the hue family of their light counterparts so the slides
 * stay recognisable across themes.
 */
function backgroundColorFor(
  slide: Slide | undefined,
  scheme: 'light' | 'dark',
): string {
  const dark = scheme === 'dark';
  if (!slide) return dark ? '#15102b' : '#f5f3ff';
  switch (slide.kind) {
    case 'cover':
      return dark ? '#1e1b3a' : '#ede9fe';
    case 'page':
      // Alternate two warm tones based on page number so consecutive pages
      // contrast against each other when revealed by the wave.
      return slide.page.pageNumber % 2 === 0
        ? dark
          ? '#2a1f0e'
          : '#fef3c7'
        : dark
          ? '#2a0f1d'
          : '#fce7f3';
    case 'choices':
      return dark ? '#2d1a0c' : '#fed7aa';
    case 'loading-next':
      return dark ? '#161630' : '#e0e7ff';
    case 'end':
      return dark ? '#0d2818' : '#dcfce7';
  }
}

export function BookPlayer({
  book,
  onComplete,
  onChoose,
  onBack,
}: BookPlayerProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(
    null,
  );
  /**
   * Whether the narration audio for the current slide has finished. Drives
   * whether the swipe affordances are armed — kids only get to turn the
   * page once the page has actually been read to them.
   *
   * Paired with a "track" we compare against the live slide key so the
   * state resets synchronously during render when the slide changes. A
   * `useEffect`-based reset leaks the previous value into the first render
   * of the new slide and the wave flashes for one frame before snapping
   * back — the in-render reset (React docs' recommended pattern) avoids
   * that.
   */
  const [audioFinished, setAudioFinished] = useState(false);
  const [audioFinishedTrack, setAudioFinishedTrack] = useState<string | null>(
    null,
  );
  /**
   * Once the kid has reached the end slide we unlock the backwards
   * navigation so they can flip through the whole book to re-read pages.
   * During the *first* read we hide the previous-page handle so the only
   * affordance is "keep going" — keeps focus on the story.
   */
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const slides = useMemo<Slide[]>(() => buildSlides(book), [book]);
  // Clamp the index — if the book updates and the previous index points
  // past the new length (e.g. interactive page lost the choices slide and
  // gained a regular page), bring it back into range so the player doesn't
  // crash.
  const safeIndex = Math.min(
    Math.max(index, 0),
    Math.max(slides.length - 1, 0),
  );
  const currentSlide = slides[safeIndex];
  const prevSlide = slides[safeIndex - 1];
  const nextSlide = slides[safeIndex + 1];

  const audioSource = useMemo(() => {
    if (currentSlide?.kind === 'cover') return book.titleAudioUrl;
    if (currentSlide?.kind === 'page') return currentSlide.page.audioUrl;
    return null;
  }, [currentSlide, book.titleAudioUrl]);

  // In-render reset of `audioFinished` so the new slide never gets one
  // frame of the previous slide's "finished" flag. React sees the setState
  // during render and re-renders before committing, so the wave/next slide
  // never have a chance to flash open between slides.
  const audioTrack = `${safeIndex}|${audioSource ?? 'none'}`;
  if (audioFinishedTrack !== audioTrack) {
    setAudioFinishedTrack(audioTrack);
    setAudioFinished(false);
  }

  const { currentTime, duration } = useBookAudio({
    source: audioSource,
    autoPlay: true,
    onComplete: () => setAudioFinished(true),
  });

  // 0..1 narration progress driving the karaoke-style text highlight.
  // While audio is loading (duration=0) progress is 0 → text is dim;
  // once playback completes we snap to 1 so the page reads fully.
  const audioProgress = audioFinished
    ? 1
    : duration > 0
      ? Math.min(Math.max(currentTime / duration, 0), 1)
      : 0;

  // Cover + content pages are read aloud — kids only get the page-turn
  // affordance after the narration finishes. Choices / end / loading-next
  // slides aren't narrated, so swipes there are armed straight away.
  const slideExpectsAudio =
    currentSlide?.kind === 'cover' || currentSlide?.kind === 'page';
  const canSwipe = !slideExpectsAudio || audioFinished;

  // Reset to the cover whenever the book identity changes (different bookId).
  useEffect(() => {
    setIndex(0);
    setHasReachedEnd(false);
  }, [book.id]);

  // Latch the "finished a first pass" flag the moment the end slide is
  // shown. Once set it stays set for the rest of the session, so the
  // user can freely flip back and forth.
  useEffect(() => {
    if (currentSlide?.kind === 'end') setHasReachedEnd(true);
  }, [currentSlide?.kind]);

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

  const renderSlide = (slide: Slide, role: 'current' | 'prev' | 'next') => {
    const background = backgroundColorFor(slide, scheme);
    // Narration progress is "live" only on the active slide. Already-read
    // slides (prev) show fully lit text, upcoming ones (next) stay dim.
    const slideProgress =
      role === 'current' ? audioProgress : role === 'prev' ? 1 : 0;
    switch (slide.kind) {
      case 'cover':
        return (
          <SlideContainer background={background}>
            <CoverSlide
              imageUrl={book.coverImageUrl}
              title={book.title}
              progress={slideProgress}
            />
          </SlideContainer>
        );
      case 'page':
        return (
          <SlideContainer background={background}>
            <PageSlide page={slide.page} progress={slideProgress} />
          </SlideContainer>
        );
      case 'choices':
        return (
          <SlideContainer background={background}>
            <ChoicesSlide
              choices={slide.page.choices}
              pendingChoiceIndex={pendingChoiceIndex}
              onPick={handlePickChoice}
            />
          </SlideContainer>
        );
      case 'loading-next':
        return (
          <SlideContainer background={background}>
            <LoadingNextSlide />
          </SlideContainer>
        );
      case 'end':
        return (
          <SlideContainer background={background}>
            <EndSlide isFinishing={isFinishing} onFinish={handleFinish} />
          </SlideContainer>
        );
    }
  };

  // Paint the root view with the *current* slide's colour so the screen
  // edges (status bar, home indicator) blend with the page — the Slider
  // mounts in `absoluteFill` and any frame where it remounts (on index
  // change) would otherwise flash white from the screen's default bg.
  const rootBackground = backgroundColorFor(currentSlide, scheme);

  return (
    <View className="flex-1" style={{ backgroundColor: rootBackground }}>
      {currentSlide && (
        // `key` so the Slider tears down its in-flight wave state each
        // time the index advances — the wave always starts fresh.
        <Slider
          key={`${book.id}-${safeIndex}`}
          index={safeIndex}
          setIndex={setIndex}
          // Swipes are gated on the narration finishing — until then the
          // pull-tabs / wave don't appear because we hand the Slider
          // `undefined` neighbours. Backwards navigation stays hidden
          // during the first read-through (unlocked by reaching the end
          // slide) so the only affordance is "keep going".
          prev={
            canSwipe && hasReachedEnd && prevSlide
              ? renderSlide(prevSlide, 'prev')
              : undefined
          }
          next={
            canSwipe && nextSlide ? renderSlide(nextSlide, 'next') : undefined
          }
        >
          {renderSlide(currentSlide, 'current')}
        </Slider>
      )}

      {/* Back button — always visible over the slide content. The host
          screen still renders a ModalHeader of its own; this is a player-
          owned exit so kids can leave even if they scroll the slides
          weird and lose the header. */}
      {onBack && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 16 }}
        >
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Close book"
            hitSlop={12}
            className="w-11 h-11 rounded-full bg-black/35 items-center justify-center"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color="#ffffff"
            />
          </Pressable>
        </View>
      )}

      {/* Page indicator pinned to the very bottom, just above the home
          indicator. Pointer-events off so it doesn't fight the wave for
          touches near the bottom edge. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 items-center"
        style={{ bottom: Math.max(insets.bottom, 8) }}
      >
        <PageIndicator current={safeIndex} total={slides.length} />
      </View>
    </View>
  );
}

function SlideContainer({
  background,
  children,
}: {
  background: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: background }]}>
      {children}
    </View>
  );
}

/**
 * Header row at the top of every titled slide. Sits at the same Y as
 * the player's back-chevron (`top: insets.top + 8`, 44px square) and
 * matches its height so the title vertically centres with the chevron
 * regardless of length. Long titles auto-shrink (single line) instead
 * of wrapping — keeps the header geometry stable so the alignment
 * never drifts, and avoids truncation since a kid needs to see the
 * whole title.
 */
const HEADER_HEIGHT = 44;
const HEADER_TOP_OFFSET = 8;
const HEADER_LEFT_OFFSET = 68;

function SlideHeader({
  title,
  narrate,
  progress,
}: {
  title: string;
  /** When true the title is rendered with karaoke-style narration highlight. */
  narrate: boolean;
  progress: number;
}) {
  const insets = useSafeAreaInsets();
  const className = 'text-2xl font-black text-black dark:text-white';
  // Force the line height to match the chevron's 44px button so the
  // glyph baseline lands on the same y as the icon optical centre.
  // Paired with a fixed font-size + `ellipsizeMode: 'tail'` (no auto-
  // shrink), every title — long or short — stays anchored at the same
  // visual position, which means alignment doesn't drift between cases.
  const titleStyle = { lineHeight: HEADER_HEIGHT };
  return (
    <View
      className="pr-4"
      style={{
        paddingTop: insets.top + HEADER_TOP_OFFSET,
        paddingLeft: HEADER_LEFT_OFFSET,
        paddingBottom: 12,
      }}
    >
      {narrate ? (
        <NarratedText
          text={title}
          progress={progress}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={titleStyle}
          className={className}
        />
      ) : (
        <ThemedText
          numberOfLines={1}
          ellipsizeMode="tail"
          style={titleStyle}
          className={className}
        >
          {title}
        </ThemedText>
      )}
    </View>
  );
}

function CoverSlide({
  imageUrl,
  title,
  progress,
}: {
  imageUrl: string | null;
  title: string;
  progress: number;
}) {
  const insets = useSafeAreaInsets();
  // Reserve room for the page indicator (dots at `bottom: max(insets.bottom, 8)`,
  // ~6px tall) plus a small breathing gap so the artwork doesn't kiss them.
  const coverBottomPadding = Math.max(insets.bottom, 8) + 20;
  return (
    <View className="flex-1">
      <SlideHeader title={title} narrate progress={progress} />
      <View
        className="px-6 pt-8 flex-1 items-center justify-start"
        style={{ paddingBottom: coverBottomPadding }}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              flex: 1,
              borderRadius: 24,
            }}
            contentFit="cover"
          />
        ) : (
          <View
            className="w-full bg-gray-200 dark:bg-zinc-700 rounded-3xl items-center justify-center"
            style={{ flex: 1 }}
          >
            <ThemedText className="text-base text-gray-500 dark:text-zinc-400">
              No cover
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

function PageSlide({
  page,
  progress,
}: {
  page: BookPagePayload;
  progress: number;
}) {
  const insets = useSafeAreaInsets();
  // Bottom padding clears the page indicator + a comfortable reading
  // gap so the last line of text never butts up against the dots.
  const scrollBottomPadding = Math.max(insets.bottom, 8) + 40;
  return (
    <View className="flex-1">
      <SlideHeader title={page.title} narrate={false} progress={progress} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: scrollBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
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
        <NarratedText
          text={page.content}
          progress={progress}
          className="text-xl text-black dark:text-white leading-8 mt-5"
        />
      </ScrollView>
    </View>
  );
}

function EndSlide({
  isFinishing,
  onFinish,
}: {
  isFinishing: boolean;
  onFinish: () => void;
}) {
  return (
    <View className="flex-1 px-6 pt-32 items-center">
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
  choices,
  pendingChoiceIndex,
  onPick,
}: {
  choices: BookChoice[];
  pendingChoiceIndex: number | null;
  onPick: (choiceIndex: number) => void;
}) {
  return (
    <View className="flex-1 px-6 pt-20">
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
                'bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden',
                isPending
                  ? 'border-black dark:border-white'
                  : 'border-gray-200 dark:border-zinc-700',
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

function LoadingNextSlide() {
  return (
    <View className="flex-1 px-6 pt-32 items-center">
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
              ? 'w-6 bg-black dark:bg-white'
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
