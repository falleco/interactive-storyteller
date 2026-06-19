import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type {
  StoryGameDescriptor,
  StoryGameNarrationCueId,
} from '@wondertales/shared/games';
import type {
  NarrationAudioTiming,
  NarrationBlock,
  NarrationWordTiming,
} from '@wondertales/shared/stories';
import { type AudioPlayer, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type DefaultGodotGameEvent,
  DefaultGodotGamePage,
} from '~/features/games/godot';
import { buildStoryGameSessionKey } from '~/features/games/story-game-events';
import { FlatButton } from '~/shared/components/core/flat-button';
import { Slider } from '~/shared/components/core/liquid-swipe';
import { ThemedText } from '~/shared/components/themed-text';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
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
  /** Called when the embedded story game emits its completion signal. */
  onCompleteGame?: (input: {
    page: BookPagePayload;
    game: StoryGameDescriptor;
  }) => Promise<void> | void;
  /** Session key for a story game that just returned from its native screen. */
  completedGameKey?: string | null;
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
  | { kind: 'game'; page: BookPagePayload; game: StoryGameDescriptor }
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
    case 'game':
      return dark ? '#07302d' : '#ccfbf1';
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
  onCompleteGame,
  completedGameKey,
  onBack,
}: BookPlayerProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const gameNarrationPlayer = useAudioPlayer(null) as AudioPlayer;
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(
    null,
  );
  const launchedGameRef = useRef<string | null>(null);
  const advancedAfterGameRef = useRef<string | null>(null);
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
  const [narrationBlockIndex, setNarrationBlockIndex] = useState(0);
  const [narrationTrack, setNarrationTrack] = useState<string | null>(null);
  const [paginationRevealTrack, setPaginationRevealTrack] = useState<
    string | null
  >(null);
  const [paginationRevealed, setPaginationRevealed] = useState(false);
  const [coverIntroTrack, setCoverIntroTrack] = useState<string | null>(null);
  const [coverIntroComplete, setCoverIntroComplete] = useState(false);
  /**
   * Once the kid has reached the end slide we unlock the backwards
   * navigation so they can flip through the whole book to re-read pages.
   * During the *first* read we hide the previous-page handle so the only
   * affordance is "keep going" — keeps focus on the story.
   */
  const [hasReachedEnd, setHasReachedEnd] = useState(false);

  const slides = useMemo<Slide[]>(
    () => buildSlides(book, completedGameKey),
    [book, completedGameKey],
  );
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

  const currentNarrationBlocks = useMemo(
    () =>
      currentSlide?.kind === 'page'
        ? normalizePageNarrationBlocks(currentSlide.page, book.defaultVoice)
        : [],
    [currentSlide, book.defaultVoice],
  );

  const nextNarrationTrack = `${safeIndex}|${currentNarrationBlocks
    .map((block) => `${block.id}:${block.audioUrl ?? ''}:${block.text}`)
    .join('|')}`;
  if (narrationTrack !== nextNarrationTrack) {
    setNarrationTrack(nextNarrationTrack);
    setNarrationBlockIndex(0);
  }

  const safeNarrationBlockIndex = Math.min(
    Math.max(narrationBlockIndex, 0),
    Math.max(currentNarrationBlocks.length - 1, 0),
  );
  const activeNarrationBlock = currentNarrationBlocks[safeNarrationBlockIndex];

  const audioSource = useMemo(() => {
    if (currentSlide?.kind === 'cover') return book.titleAudioUrl;
    if (currentSlide?.kind === 'page') {
      return activeNarrationBlock?.audioUrl ?? currentSlide.page.audioUrl;
    }
    return null;
  }, [currentSlide, book.titleAudioUrl, activeNarrationBlock]);

  // In-render reset of `audioFinished` so the new slide never gets one
  // frame of the previous slide's "finished" flag. React sees the setState
  // during render and re-renders before committing, so the wave/next slide
  // never have a chance to flash open between slides.
  const audioTrack = `${safeIndex}|${safeNarrationBlockIndex}|${audioSource ?? 'none'}`;
  if (audioFinishedTrack !== audioTrack) {
    setAudioFinishedTrack(audioTrack);
    setAudioFinished(false);
  }

  const paginationTrack = `${book.id}|${safeIndex}|${currentSlide?.kind ?? 'none'}`;
  if (paginationRevealTrack !== paginationTrack) {
    setPaginationRevealTrack(paginationTrack);
    setPaginationRevealed(false);
  }

  const nextCoverIntroTrack = `${book.id}|${book.title}|${book.coverImageUrl ?? ''}`;
  if (coverIntroTrack !== nextCoverIntroTrack) {
    setCoverIntroTrack(nextCoverIntroTrack);
    setCoverIntroComplete(false);
  }

  const handleAudioComplete = useCallback(() => {
    if (
      currentSlide?.kind === 'page' &&
      safeNarrationBlockIndex < currentNarrationBlocks.length - 1
    ) {
      setNarrationBlockIndex((current) =>
        Math.min(current + 1, currentNarrationBlocks.length - 1),
      );
      return;
    }
    setAudioFinished(true);
  }, [
    currentSlide?.kind,
    currentNarrationBlocks.length,
    safeNarrationBlockIndex,
  ]);

  const { currentTime, duration } = useBookAudio({
    source: audioSource,
    autoPlay: true,
    onComplete: handleAudioComplete,
  });

  useEffect(() => {
    return () => {
      try {
        gameNarrationPlayer.pause();
      } catch {
        // ignore
      }
    };
  }, [gameNarrationPlayer]);

  const playGameNarrationCue = useCallback(
    (game: StoryGameDescriptor, cueId: StoryGameNarrationCueId) => {
      const audioUrl = resolveGameNarrationAudioUrl(game, book.language, cueId);
      if (!audioUrl) return;
      try {
        gameNarrationPlayer.replace({ uri: audioUrl });
        gameNarrationPlayer.play();
      } catch (error) {
        console.warn('[BookPlayer] game narration audio failed', error);
      }
    },
    [book.language, gameNarrationPlayer],
  );

  const handleGameEvent = useCallback(
    (game: StoryGameDescriptor, event: DefaultGodotGameEvent) => {
      const cueId = gameNarrationCueForEvent(event);
      if (!cueId) return;
      playGameNarrationCue(game, cueId);
    },
    [playGameNarrationCue],
  );

  useEffect(() => {
    if (currentSlide?.kind !== 'page') return;
    if (currentNarrationBlocks.length === 0) return;
    if (audioSource) return;
    if (safeNarrationBlockIndex < currentNarrationBlocks.length - 1) {
      setNarrationBlockIndex((current) =>
        Math.min(current + 1, currentNarrationBlocks.length - 1),
      );
      return;
    }
    setAudioFinished(true);
  }, [
    audioSource,
    currentSlide?.kind,
    currentNarrationBlocks.length,
    safeNarrationBlockIndex,
  ]);

  // 0..1 narration progress driving the karaoke-style text highlight.
  // While audio is loading (duration=0) progress is 0 → text is dim;
  // once playback completes we snap to 1 so the page reads fully.
  const audioProgress = audioFinished
    ? 1
    : duration > 0
      ? Math.min(Math.max(currentTime / duration, 0), 1)
      : 0;

  // The cover is gated by its magic intro. Content pages are still gated by
  // narration unless the user taps to reveal pagination early.
  const slideExpectsAudio =
    currentSlide?.kind === 'page' &&
    (currentNarrationBlocks.some((block) => Boolean(block.audioUrl)) ||
      Boolean(currentSlide.page.audioUrl));
  const canSwipe =
    currentSlide?.kind === 'cover'
      ? coverIntroComplete
      : !slideExpectsAudio || audioFinished;
  const canExposePagination =
    currentSlide?.kind === 'cover'
      ? coverIntroComplete
      : canSwipe || paginationRevealed;
  const currentGameKey =
    currentSlide?.kind === 'game'
      ? buildGameSessionKey(book.id, currentSlide.page, currentSlide.game)
      : null;
  const currentGameCompletedThisSession =
    currentGameKey !== null &&
    completedGameKey === currentGameKey &&
    launchedGameRef.current === currentGameKey;
  const canRevealNext =
    canExposePagination &&
    (currentSlide?.kind !== 'game' || currentGameCompletedThisSession);
  const autoAdvanceKey =
    currentGameCompletedThisSession &&
    nextSlide &&
    advancedAfterGameRef.current !== currentGameKey
      ? currentGameKey
      : null;

  // Reset to the cover whenever the book identity changes (different bookId).
  useEffect(() => {
    setIndex(0);
    setHasReachedEnd(false);
    launchedGameRef.current = null;
    advancedAfterGameRef.current = null;
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

  const handleCompleteGame = useCallback(
    async (page: BookPagePayload, game: StoryGameDescriptor) => {
      if (!onCompleteGame) return;
      const gameKey = buildGameSessionKey(book.id, page, game);
      launchedGameRef.current = gameKey;
      advancedAfterGameRef.current = null;
      await onCompleteGame({ page, game });
    },
    [book.id, onCompleteGame],
  );

  const handleAutoAdvanceStart = useCallback((key: string) => {
    advancedAfterGameRef.current = key;
  }, []);

  const handleRevealPagination = useCallback(() => {
    if (!currentSlide || currentSlide.kind === 'game') return;
    setPaginationRevealed(true);
  }, [currentSlide]);

  const handleCoverIntroComplete = useCallback(() => {
    setCoverIntroComplete(true);
  }, []);

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
              introComplete={role !== 'current' || coverIntroComplete}
              onIntroComplete={handleCoverIntroComplete}
            />
          </SlideContainer>
        );
      case 'page':
        return (
          <SlideContainer background={background}>
            <PageSlide
              page={slide.page}
              defaultVoice={book.defaultVoice}
              currentTime={role === 'current' ? currentTime : undefined}
              activeBlockIndex={
                role === 'current'
                  ? safeNarrationBlockIndex
                  : role === 'prev'
                    ? Number.MAX_SAFE_INTEGER
                    : -1
              }
              progress={slideProgress}
            />
          </SlideContainer>
        );
      case 'game':
        return (
          <SlideContainer background={background}>
            <GameSlide
              game={slide.game}
              onEvent={(event) => handleGameEvent(slide.game, event)}
              onComplete={() => handleCompleteGame(slide.page, slide.game)}
            />
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
    <View
      className="flex-1"
      style={{ backgroundColor: rootBackground }}
      onTouchStart={handleRevealPagination}
    >
      {currentSlide && (
        // `key` so the Slider tears down its in-flight wave state each
        // time the index advances — the wave always starts fresh.
        <Slider
          key={`${book.id}-${safeIndex}`}
          index={safeIndex}
          setIndex={setIndex}
          // Page controls appear when narration finishes, or earlier if the
          // user taps the page. Backwards navigation stays hidden during the
          // first read-through (unlocked by reaching the end slide).
          prev={
            canExposePagination && hasReachedEnd && prevSlide
              ? renderSlide(prevSlide, 'prev')
              : undefined
          }
          next={
            canRevealNext && nextSlide
              ? renderSlide(nextSlide, 'next')
              : undefined
          }
          autoAdvanceKey={autoAdvanceKey}
          gestureEnabled={
            currentSlide?.kind !== 'game' || currentGameCompletedThisSession
          }
          onAutoAdvanceStart={handleAutoAdvanceStart}
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
        {currentSlide?.kind !== 'game' && (
          <PageIndicator current={safeIndex} total={slides.length} />
        )}
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

function CoverSlide({
  imageUrl,
  title,
  introComplete,
  onIntroComplete,
}: {
  imageUrl: string | null;
  title: string;
  introComplete: boolean;
  onIntroComplete: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const titleRuns = useMemo(() => buildCoverTitleRuns(title), [title]);
  const glyphCount = useMemo(
    () => titleRuns.reduce((sum, run) => sum + run.glyphs.length, 0),
    [titleRuns],
  );
  const titleBottomOffset = Math.max(insets.bottom, 8) + 32;
  const introLift = -Math.max(180, height * 0.42 - titleBottomOffset);
  const revealProgress = useSharedValue(introComplete ? glyphCount : 0);
  const settleProgress = useSharedValue(introComplete ? 1 : 0);
  const sparkleProgress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(revealProgress);
    cancelAnimation(settleProgress);
    cancelAnimation(sparkleProgress);

    if (introComplete) {
      revealProgress.set(glyphCount);
      settleProgress.set(1);
      sparkleProgress.set(0);
      return;
    }

    revealProgress.set(0);
    settleProgress.set(0);
    sparkleProgress.set(
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 620,
            easing: Easing.inOut(Easing.cubic),
          }),
          withTiming(0, {
            duration: 680,
            easing: Easing.inOut(Easing.cubic),
          }),
        ),
        -1,
        false,
      ),
    );

    const typeDuration = Math.min(Math.max(glyphCount * 58, 1200), 3200);
    revealProgress.set(
      withTiming(
        glyphCount,
        {
          duration: typeDuration,
          easing: Easing.linear,
        },
        (finished) => {
          if (!finished) return;
          settleProgress.set(
            withDelay(
              420,
              withTiming(
                1,
                {
                  duration: 820,
                  easing: Easing.out(Easing.cubic),
                },
                (settled) => {
                  if (!settled) return;
                  cancelAnimation(sparkleProgress);
                  sparkleProgress.set(0);
                  runOnJS(onIntroComplete)();
                },
              ),
            ),
          );
        },
      ),
    );

    return () => {
      cancelAnimation(revealProgress);
      cancelAnimation(settleProgress);
      cancelAnimation(sparkleProgress);
    };
  }, [
    glyphCount,
    introComplete,
    onIntroComplete,
    revealProgress,
    settleProgress,
    sparkleProgress,
  ]);

  const titleStageStyle = useAnimatedStyle(() => {
    const settle = settleProgress.get();
    return {
      opacity: 0.94 + settle * 0.06,
      transform: [
        { translateY: (1 - settle) * introLift },
        { scale: 1.06 - settle * 0.06 },
      ],
    };
  }, [introLift]);

  return (
    <View className="flex-1 bg-zinc-950">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          className="items-center justify-center bg-gray-200 dark:bg-zinc-800"
          style={StyleSheet.absoluteFill}
        >
          <ThemedText className="text-base text-gray-500 dark:text-zinc-400">
            No cover
          </ThemedText>
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.coverTitleStage,
          { bottom: titleBottomOffset },
          titleStageStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.coverSparkleLayer}>
          {COVER_SPARKLES.map((sparkle, index) => (
            <CoverSparkle
              // biome-ignore lint/suspicious/noArrayIndexKey: sparkles are fixed decorative positions
              key={`cover-sparkle-${index}`}
              revealProgress={revealProgress}
              settleProgress={settleProgress}
              sparkleProgress={sparkleProgress}
              glyphCount={glyphCount}
              index={index}
              {...sparkle}
            />
          ))}
        </View>
        <View style={styles.coverTitleWrap}>
          {titleRuns.map((run) =>
            run.kind === 'space' ? (
              <View
                key={run.id}
                style={{
                  width: Math.min(run.glyphs.length * 10, 36),
                  height: COVER_TITLE_LINE_HEIGHT,
                }}
              />
            ) : (
              <View key={run.id} style={styles.coverTitleWord}>
                {run.glyphs.map((glyph, index) => (
                  <CoverTitleGlyph
                    // biome-ignore lint/suspicious/noArrayIndexKey: glyph order is stable within the word
                    key={`${run.id}-${index}`}
                    glyph={glyph}
                    index={run.start + index}
                    revealProgress={revealProgress}
                  />
                ))}
              </View>
            ),
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const COVER_TITLE_LINE_HEIGHT = 42;

interface CoverTitleRun {
  id: string;
  kind: 'word' | 'space';
  glyphs: string[];
  start: number;
}

function buildCoverTitleRuns(title: string): CoverTitleRun[] {
  const runs: CoverTitleRun[] = [];
  const glyphs = Array.from(title);
  let activeKind: CoverTitleRun['kind'] | null = null;
  let activeGlyphs: string[] = [];
  let activeStart = 0;

  for (let index = 0; index < glyphs.length; index += 1) {
    const glyph = glyphs[index];
    const kind = /\s/.test(glyph) ? 'space' : 'word';
    if (activeKind !== kind) {
      if (activeKind) {
        runs.push({
          id: `${activeKind}-${activeStart}-${runs.length}`,
          kind: activeKind,
          glyphs: activeGlyphs,
          start: activeStart,
        });
      }
      activeKind = kind;
      activeGlyphs = [glyph];
      activeStart = index;
    } else {
      activeGlyphs.push(glyph);
    }
  }

  if (activeKind) {
    runs.push({
      id: `${activeKind}-${activeStart}-${runs.length}`,
      kind: activeKind,
      glyphs: activeGlyphs,
      start: activeStart,
    });
  }

  return runs;
}

function CoverTitleGlyph({
  glyph,
  index,
  revealProgress,
}: {
  glyph: string;
  index: number;
  revealProgress: SharedValue<number>;
}) {
  const glyphStyle = useAnimatedStyle(() => {
    const t = Math.min(Math.max(revealProgress.get() - index, 0), 1);
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }, { scale: 0.84 + t * 0.16 }],
    };
  }, [index]);

  return (
    <Animated.Text
      accessible={false}
      style={[styles.coverTitleGlyph, glyphStyle]}
    >
      {glyph}
    </Animated.Text>
  );
}

const COVER_SPARKLES = [
  { left: '14%', top: -28, size: 18, revealAt: 0.06 },
  { left: '29%', top: -10, size: 12, revealAt: 0.2 },
  { left: '73%', top: -24, size: 20, revealAt: 0.32 },
  { left: '86%', top: 14, size: 13, revealAt: 0.46 },
  { left: '18%', top: 44, size: 15, revealAt: 0.58 },
  { left: '65%', top: 54, size: 12, revealAt: 0.72 },
] as const;

function CoverSparkle({
  revealProgress,
  settleProgress,
  sparkleProgress,
  glyphCount,
  index,
  left,
  top,
  size,
  revealAt,
}: {
  revealProgress: SharedValue<number>;
  settleProgress: SharedValue<number>;
  sparkleProgress: SharedValue<number>;
  glyphCount: number;
  index: number;
  left: (typeof COVER_SPARKLES)[number]['left'];
  top: number;
  size: number;
  revealAt: number;
}) {
  const sparkleStyle = useAnimatedStyle(() => {
    const reveal = revealProgress.get();
    const settle = settleProgress.get();
    const loop = sparkleProgress.get();
    const visible = Math.min(
      Math.max((reveal - glyphCount * revealAt) / 2, 0),
      1,
    );
    const twinkle = 0.48 + loop * 0.52;

    return {
      opacity: visible * twinkle * Math.max(1 - settle * 0.9, 0),
      transform: [
        { translateY: -6 * loop },
        { scale: 0.7 + loop * 0.42 + (index % 2) * 0.08 },
        { rotate: `${-18 + loop * 42}deg` },
      ],
    };
  }, [glyphCount, index, revealAt]);

  return (
    <Animated.Text
      accessible={false}
      pointerEvents="none"
      style={[
        styles.coverSparkle,
        {
          left,
          top,
          fontSize: size,
          lineHeight: size + 2,
        },
        sparkleStyle,
      ]}
    >
      ✦
    </Animated.Text>
  );
}

function PageSlide({
  page,
  defaultVoice,
  currentTime,
  activeBlockIndex,
  progress,
}: {
  page: BookPagePayload;
  defaultVoice: string;
  currentTime?: number;
  activeBlockIndex: number;
  progress: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const blocks = useMemo(
    () => normalizePageNarrationBlocks(page, defaultVoice),
    [page, defaultVoice],
  );
  const safeBlockIndex = Math.min(
    Math.max(activeBlockIndex, 0),
    Math.max(blocks.length - 1, 0),
  );
  const activeBlock = blocks[safeBlockIndex];
  const activeBlockProgress =
    activeBlockIndex < 0 ? 0 : activeBlockIndex >= blocks.length ? 1 : progress;
  const activeBlockTime =
    activeBlockIndex >= 0 && activeBlockIndex < blocks.length
      ? currentTime
      : undefined;
  const charBudget = Math.max(22, Math.min(34, Math.floor((width - 48) / 11)));
  const karaokePlan = useMemo(
    () => buildPageKaraokePlan(blocks, page.content, charBudget),
    [blocks, page.content, charBudget],
  );
  const activeBlockStartWord =
    karaokePlan.blockStartWordIndexes[safeBlockIndex] ?? 0;
  const activeBlockWordCount = karaokePlan.blockWordCounts[safeBlockIndex] ?? 0;
  const activeWordIndex = resolveKaraokeActiveWordIndex({
    lines: karaokePlan.lines,
    timing: activeBlock?.audioTiming ?? null,
    currentTime: activeBlockTime,
    progress: activeBlockProgress,
    startWordIndex: activeBlockStartWord,
    endWordIndex: activeBlockStartWord + Math.max(activeBlockWordCount - 1, 0),
  });
  const activeLineIndex = resolveKaraokeWindowStartLine(
    karaokePlan.lines,
    activeWordIndex,
  );
  const overlayBottom = Math.max(insets.bottom, 8) + 32;

  return (
    <View className="flex-1 bg-zinc-950">
      {page.imageUrl ? (
        <Image
          source={{ uri: page.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          className="items-center justify-center bg-gray-100 dark:bg-zinc-800"
          style={StyleSheet.absoluteFill}
        >
          <ThemedText className="text-sm text-gray-400 dark:text-zinc-500">
            Image coming…
          </ThemedText>
        </View>
      )}

      <View pointerEvents="none" style={styles.storyImageScrim} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0, 0, 0, 0)',
          'rgba(0, 0, 0, 0.5)',
          'rgba(0, 0, 0, 0.76)',
        ]}
        locations={[0, 0.48, 1]}
        style={[styles.storyNarrationScrim, { paddingBottom: overlayBottom }]}
      >
        <KaraokeNarrationWindow
          lines={karaokePlan.lines}
          activeWordIndex={activeWordIndex}
          activeLineIndex={activeLineIndex}
          speaker={activeBlock?.speaker}
        />
      </LinearGradient>
    </View>
  );
}

const KARAOKE_LINE_HEIGHT = 34;
const KARAOKE_VISIBLE_LINES = 2;

interface KaraokeToken {
  id: string;
  kind: 'word' | 'space';
  text: string;
  normalized: string;
  wordIndex: number | null;
}

interface KaraokeLine {
  id: string;
  tokens: KaraokeToken[];
  firstWordIndex: number;
  lastWordIndex: number;
}

interface KaraokePlan {
  lines: KaraokeLine[];
  blockStartWordIndexes: number[];
  blockWordCounts: number[];
}

function KaraokeNarrationWindow({
  lines,
  activeWordIndex,
  activeLineIndex,
  speaker,
}: {
  lines: KaraokeLine[];
  activeWordIndex: number;
  activeLineIndex: number;
  speaker?: string | null;
}) {
  const lineOffset = useSharedValue(activeLineIndex);

  useEffect(() => {
    lineOffset.set(
      withTiming(activeLineIndex, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [activeLineIndex, lineOffset]);

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lineOffset.get() * KARAOKE_LINE_HEIGHT }],
  }));

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={lines
        .flatMap((line) => line.tokens.map((token) => token.text))
        .join('')}
      style={styles.karaokeWindow}
    >
      <ThemedText
        style={[styles.karaokeSpeaker, !speaker && styles.karaokeSpeakerEmpty]}
      >
        {speaker ?? ' '}
      </ThemedText>
      <View style={styles.karaokeMask}>
        <Animated.View style={stackStyle}>
          {lines.map((line, index) => (
            <KaraokeLineView
              key={line.id}
              line={line}
              index={index}
              lineOffset={lineOffset}
              activeWordIndex={activeWordIndex}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

function KaraokeLineView({
  line,
  index,
  lineOffset,
  activeWordIndex,
}: {
  line: KaraokeLine;
  index: number;
  lineOffset: SharedValue<number>;
  activeWordIndex: number;
}) {
  const lineStyle = useAnimatedStyle(() => {
    const distance = index - lineOffset.get();
    const above = Math.max(Math.min(-distance, 1), 0);
    const below = Math.max(
      Math.min(distance - (KARAOKE_VISIBLE_LINES - 1), 1),
      0,
    );
    const opacity = Math.max(1 - above * 1.15 - below * 1.15, 0);

    return {
      opacity,
      transform: [{ translateY: -8 * above + 6 * below }],
    };
  }, [index, lineOffset]);

  return (
    <Animated.View style={[styles.karaokeLine, lineStyle]}>
      <Animated.Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={1}
        style={styles.karaokeLineText}
      >
        {line.tokens.map((token) => {
          if (token.kind === 'space') return token.text;
          const isNarrated =
            token.wordIndex !== null && token.wordIndex <= activeWordIndex;
          return (
            <Animated.Text
              key={token.id}
              style={
                isNarrated
                  ? styles.karaokeWordNarrated
                  : styles.karaokeWordUpcoming
              }
            >
              {token.text}
            </Animated.Text>
          );
        })}
      </Animated.Text>
    </Animated.View>
  );
}

function buildPageKaraokePlan(
  blocks: NarrationBlock[],
  fallbackText: string,
  maxChars: number,
): KaraokePlan {
  const sourceBlocks =
    blocks.length > 0
      ? blocks
      : ([
          {
            id: 'fallback',
            kind: 'narration',
            text: fallbackText,
            voice: null,
            speaker: null,
            audioUrl: null,
            audioObjectKey: null,
            audioTiming: null,
          },
        ] satisfies NarrationBlock[]);

  const lines: KaraokeLine[] = [];
  const blockStartWordIndexes: number[] = [];
  const blockWordCounts: number[] = [];
  let nextWordIndex = 0;

  sourceBlocks.forEach((block, blockIndex) => {
    const wordCount = countKaraokeWords(block.text);
    blockStartWordIndexes.push(nextWordIndex);
    blockWordCounts.push(wordCount);
    lines.push(
      ...buildKaraokeLines(block.text, maxChars, {
        idPrefix: `block-${block.id || blockIndex}`,
        startWordIndex: nextWordIndex,
      }),
    );
    nextWordIndex += wordCount;
  });

  if (lines.length > 0) {
    return { lines, blockStartWordIndexes, blockWordCounts };
  }

  return {
    lines: [
      {
        id: 'line-empty',
        tokens: [
          {
            id: 'token-empty',
            kind: 'word',
            text: '',
            normalized: '',
            wordIndex: 0,
          },
        ],
        firstWordIndex: 0,
        lastWordIndex: 0,
      },
    ],
    blockStartWordIndexes: [0],
    blockWordCounts: [0],
  };
}

function buildKaraokeLines(
  text: string,
  maxChars: number,
  {
    idPrefix = 'line',
    startWordIndex = 0,
  }: { idPrefix?: string; startWordIndex?: number } = {},
): KaraokeLine[] {
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);
  const lines: KaraokeLine[] = [];
  let currentTokens: KaraokeToken[] = [];
  let currentChars = 0;
  let firstWordIndex = -1;
  let lastWordIndex = -1;
  let wordIndex = startWordIndex - 1;

  const pushLine = () => {
    const tokens = trimKaraokeLineTokens(currentTokens);
    if (tokens.length === 0) return;
    lines.push({
      id: `${idPrefix}-line-${lines.length}`,
      tokens,
      firstWordIndex:
        firstWordIndex >= 0 ? firstWordIndex : Math.max(lastWordIndex, 0),
      lastWordIndex: Math.max(lastWordIndex, firstWordIndex, 0),
    });
    currentTokens = [];
    currentChars = 0;
    firstWordIndex = -1;
    lastWordIndex = -1;
  };

  parts.forEach((part) => {
    const isSpace = /^\s+$/.test(part);
    if (isSpace && currentTokens.length === 0) return;

    const nextWordIndex = isSpace ? null : wordIndex + 1;
    const token: KaraokeToken = {
      id: `${idPrefix}-token-${wordIndex + 1}-${currentTokens.length}`,
      kind: isSpace ? 'space' : 'word',
      text: part,
      normalized: isSpace ? '' : normalizeKaraokeWord(part),
      wordIndex: nextWordIndex,
    };
    const tokenChars = isSpace ? 1 : part.length;

    if (
      !isSpace &&
      currentTokens.length > 0 &&
      currentChars + tokenChars > maxChars
    ) {
      pushLine();
    }

    currentTokens.push(token);
    currentChars += tokenChars;

    if (!isSpace && nextWordIndex !== null) {
      wordIndex = nextWordIndex;
      if (firstWordIndex < 0) firstWordIndex = nextWordIndex;
      lastWordIndex = nextWordIndex;
    }
  });

  pushLine();

  return lines;
}

function trimKaraokeLineTokens(tokens: KaraokeToken[]): KaraokeToken[] {
  let start = 0;
  let end = tokens.length;
  while (start < end && tokens[start].kind === 'space') start += 1;
  while (end > start && tokens[end - 1].kind === 'space') end -= 1;
  return tokens.slice(start, end);
}

function countKaraokeWords(text: string): number {
  return text
    .split(/(\s+)/)
    .filter((part) => part.length > 0 && !/^\s+$/.test(part)).length;
}

function resolveKaraokeActiveWordIndex({
  lines,
  timing,
  currentTime,
  progress,
  startWordIndex,
  endWordIndex,
}: {
  lines: KaraokeLine[];
  timing: NarrationAudioTiming | null;
  currentTime?: number;
  progress: number;
  startWordIndex: number;
  endWordIndex: number;
}): number {
  const words = lines
    .flatMap((line) => line.tokens.filter((token) => token.kind === 'word'))
    .filter(
      (token) =>
        token.wordIndex !== null &&
        token.wordIndex >= startWordIndex &&
        token.wordIndex <= endWordIndex,
    );
  if (words.length === 0) return startWordIndex - 1;

  const alignedTimings = alignKaraokeTimings(words, timing?.words ?? []);
  if (currentTime !== undefined && alignedTimings.length > 0) {
    let lastNarrated = startWordIndex - 1;
    for (const item of alignedTimings) {
      if (currentTime < item.startTime) return lastNarrated;
      if (currentTime <= item.endTime) return item.wordIndex;
      lastNarrated = item.wordIndex;
    }
    return words[words.length - 1].wordIndex ?? lastNarrated;
  }

  if (progress <= 0) return startWordIndex - 1;
  if (progress >= 1) return words[words.length - 1].wordIndex ?? endWordIndex;
  const fallbackIndex = Math.ceil(progress * words.length) - 1;
  return (
    words[Math.min(Math.max(fallbackIndex, 0), words.length - 1)].wordIndex ??
    -1
  );
}

function resolveKaraokeWindowStartLine(
  lines: KaraokeLine[],
  activeWordIndex: number,
): number {
  if (lines.length <= KARAOKE_VISIBLE_LINES) return 0;
  const targetWord = Math.max(activeWordIndex, 0);
  const targetLineIndex = lines.findIndex(
    (line) =>
      targetWord >= line.firstWordIndex && targetWord <= line.lastWordIndex,
  );
  const clampedTarget = targetLineIndex >= 0 ? targetLineIndex : 0;
  return Math.min(clampedTarget, lines.length - KARAOKE_VISIBLE_LINES);
}

function alignKaraokeTimings(
  words: KaraokeToken[],
  timings: NarrationWordTiming[],
): Array<{ wordIndex: number; startTime: number; endTime: number }> {
  if (words.length === 0 || timings.length === 0) return [];

  const aligned: Array<{
    wordIndex: number;
    startTime: number;
    endTime: number;
  }> = [];
  let searchFrom = 0;
  for (const timing of timings) {
    const normalized = normalizeKaraokeWord(timing.word);
    if (!normalized) continue;
    const tokenIndex = words.findIndex(
      (token, index) => index >= searchFrom && token.normalized === normalized,
    );
    if (tokenIndex === -1) continue;
    const wordIndex = words[tokenIndex].wordIndex;
    if (wordIndex === null) continue;
    aligned.push({
      wordIndex,
      startTime: timing.startTime,
      endTime: timing.endTime,
    });
    searchFrom = tokenIndex + 1;
  }
  return aligned;
}

function normalizeKaraokeWord(word: string): string {
  return word
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

function GameSlide({
  game,
  onEvent,
  onComplete,
}: {
  game: StoryGameDescriptor;
  onEvent?: (event: DefaultGodotGameEvent) => void;
  onComplete?: () => Promise<void> | void;
}) {
  return (
    <DefaultGodotGamePage
      descriptor={game}
      onEvent={onEvent}
      onComplete={onComplete}
      style={StyleSheet.absoluteFill}
    />
  );
}

function gameNarrationCueForEvent(
  event: DefaultGodotGameEvent,
): StoryGameNarrationCueId | null {
  if (event.type === 'ready') return 'start';
  if (event.type === 'success') return 'successMove';
  if (event.type === 'error') return 'failure';
  if (event.type === 'complete') return 'complete';
  return null;
}

function resolveGameNarrationAudioUrl(
  game: StoryGameDescriptor,
  language: string,
  cueId: StoryGameNarrationCueId,
): string | null {
  return (
    game.narration?.[language]?.[cueId]?.audioUrl ??
    game.narration?.en?.[cueId]?.audioUrl ??
    null
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

function buildSlides(
  book: BookDetail,
  completedGameKey?: string | null,
): Slide[] {
  const slides: Slide[] = [{ kind: 'cover' }];
  const isInteractive = book.mode === 'interactive';
  let waitingForGame = false;

  book.pages.forEach((page, idx) => {
    if (waitingForGame) return;

    const isDedicatedGamePage = page.pageType === 'game' && page.game;
    if (!isDedicatedGamePage) {
      slides.push({ kind: 'page', page });
    }

    if (page.game) {
      slides.push({ kind: 'game', page, game: page.game });
      const gameKey = buildGameSessionKey(book.id, page, page.game);
      const completedThisSession = completedGameKey === gameKey;
      if (!page.gameCompletedAt && !completedThisSession) {
        waitingForGame = true;
        return;
      }
    }

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
    !waitingForGame &&
    (isInteractive
      ? lastPage !== undefined && lastPage.pageNumber >= STORY_PAGE_COUNT
      : true);
  if (storyComplete) {
    slides.push({ kind: 'end' });
  }

  return slides;
}

function normalizePageNarrationBlocks(
  page: BookPagePayload,
  defaultVoice: string,
): NarrationBlock[] {
  const blocks =
    page.narrationBlocks.length > 0
      ? page.narrationBlocks
      : page.narrationText.trim() || page.content.trim()
        ? [
            {
              id: 'block-1',
              kind: 'narration',
              text: page.narrationText.trim() || page.content.trim(),
              voice: null,
              speaker: null,
              audioUrl: page.audioUrl,
              audioObjectKey: null,
              audioTiming: null,
            } satisfies NarrationBlock,
          ]
        : [];

  return blocks.map((block, index) => ({
    id: block.id || `block-${index + 1}`,
    kind:
      block.kind === 'dialogue' || block.kind === 'aside'
        ? block.kind
        : 'narration',
    text: block.text,
    voice: block.voice && block.voice !== defaultVoice ? block.voice : null,
    speaker: block.speaker ?? null,
    audioUrl: block.audioUrl ?? null,
    audioObjectKey: block.audioObjectKey ?? null,
    audioTiming: block.audioTiming ?? null,
  }));
}

function buildGameSessionKey(
  bookId: string,
  page: BookPagePayload,
  game: StoryGameDescriptor,
) {
  return buildStoryGameSessionKey({
    bookId,
    pageId: page.id,
    gameId: game.id,
  });
}

const styles = StyleSheet.create({
  storyImageScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
  },
  storyNarrationScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 54,
  },
  karaokeWindow: {
    alignItems: 'center',
    width: '100%',
  },
  karaokeSpeaker: {
    marginBottom: 6,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  karaokeSpeakerEmpty: {
    opacity: 0,
  },
  karaokeMask: {
    height: KARAOKE_LINE_HEIGHT * KARAOKE_VISIBLE_LINES,
    width: '100%',
    overflow: 'hidden',
  },
  karaokeLine: {
    height: KARAOKE_LINE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  karaokeLineText: {
    color: '#ffffff',
    fontSize: 23,
    fontWeight: '800',
    lineHeight: KARAOKE_LINE_HEIGHT,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.66)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  karaokeWordNarrated: {
    color: '#ffffff',
  },
  karaokeWordUpcoming: {
    color: 'rgba(255, 255, 255, 0.42)',
  },
  coverTitleStage: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  coverSparkleLayer: {
    position: 'absolute',
    top: -34,
    left: 0,
    right: 0,
    height: 118,
  },
  coverSparkle: {
    position: 'absolute',
    color: '#ffffff',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  coverTitleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  coverTitleWord: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  coverTitleGlyph: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    lineHeight: COVER_TITLE_LINE_HEIGHT,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});
