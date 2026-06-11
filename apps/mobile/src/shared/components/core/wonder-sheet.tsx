import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { type Href, router, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type BookMode, useBooks } from '~/features/books';
import {
  type StoryTemplate,
  useStoryTemplates,
} from '~/features/story-templates';
import {
  ENABLED_LANGUAGES,
  type Storyteller,
  useStorytellers,
} from '~/features/storytellers';
import { PenIcon } from '~/shared/components/icons/pen-icon';
import { ThemedText } from '~/shared/components/themed-text';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
import { cn } from '~/shared/lib/cn';
import {
  CREATE_BUTTON_RADIUS,
  TAB_BAR_HEIGHT,
  tabBarPaddingBottom,
} from './tab-bar';

const SHEET_INSET = 18;
const SHEET_MAX_HEIGHT_RATIO = 0.62;
const ANIM_DURATION_MS = 380;
const SHEET_CORNER_RADIUS = 28;
const BLOB_SMOOTH_K = 38;

/**
 * SDF-driven blob shader. Two shapes — a circle pinned at the FAB and a
 * rounded rectangle growing upward — are smoothly merged via `smin` so
 * the rectangle appears to *grow out of* the FAB when `u_progress` rises
 * from 0 (closed) to 1 (open). Inspired by Candillon's Reflectly tab sheet.
 */
const SHADER_SOURCE = Skia.RuntimeEffect.Make(`
uniform float u_progress;
uniform float2 u_resolution;
uniform float2 u_buttonCenter;
uniform float u_buttonRadius;
uniform float u_sheetWidth;
uniform float u_sheetHeight;
uniform float u_sheetCornerRadius;
uniform float u_smoothK;
uniform float4 u_color;

float sdCircle(float2 p, float r) {
  return length(p) - r;
}

float sdRoundedBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float smin(float a, float b, float k) {
  if (k <= 0.0001) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

half4 main(float2 fragCoord) {
  if (u_progress < 0.005) return half4(0.0, 0.0, 0.0, 0.0);
  float circle = sdCircle(fragCoord - u_buttonCenter, u_buttonRadius);

  float halfW = u_sheetWidth * 0.5;
  float halfH = u_sheetHeight * u_progress * 0.5;
  float2 rectCenter = float2(
    u_resolution.x * 0.5,
    u_buttonCenter.y - u_buttonRadius - halfH
  );
  float rect = sdRoundedBox(fragCoord - rectCenter, float2(halfW, halfH), u_sheetCornerRadius);

  float k = u_smoothK * u_progress;
  float d = smin(circle, rect, k);

  if (d < 0.0) return u_color;
  return half4(0.0, 0.0, 0.0, 0.0);
}
`);

if (!SHADER_SOURCE) {
  throw new Error('[wonder-sheet] Failed to compile blob shader');
}
const BLOB_SHADER = SHADER_SOURCE;

interface WonderSheetProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

/**
 * Wizard step the sheet is currently on. Steps are 1-indexed in the
 * data flow but converted to 0-indexed when animating the carousel.
 */
type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: 'Adventure mode',
  2: 'Pick a template',
  3: 'Choose a narrator',
};

export function WonderSheet({ open, onClose, onToggle }: WonderSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scheme = useColorScheme();
  // FAB pertences to the tab bar visually — it should only appear on
  // screens where the tab bar is visible (i.e. inside the `(tabs)`
  // group). On other screens (settings, book detail, modals, etc.) we
  // hide it. The overlay itself only mounts when `open=true`, which is
  // only reachable from the FAB, so gating just the FAB is enough.
  const segments = useSegments();
  const isOnTab = segments[0] === '(tabs)';

  // ─── wizard state ────────────────────────────────────────────────
  // `step` is what the user picked; `displayedStep` lags behind during
  // a transition so we can swap the rendered content while the sheet
  // is faded to 0 — avoids the "see new content at old height, then
  // see blob morph" glitch that happens when the swap is instantaneous
  // and the blob's height tween takes 320ms.
  const [step, setStep] = useState<Step>(1);
  const [displayedStep, setDisplayedStep] = useState<Step>(1);
  const [mode, setMode] = useState<BookMode | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { create } = useBooks();

  const contentOpacity = useSharedValue(1);
  // Ref shadow of `displayedStep` so the orchestrator effect can read
  // the latest value without listing it as a dependency. If it were a
  // dep, `setDisplayedStep` inside the fade-out callback would change
  // it, re-running this effect — whose cleanup would clear the
  // fade-in timer and the content would stay invisible forever.
  const displayedStepRef = useRef<Step>(displayedStep);
  useEffect(() => {
    displayedStepRef.current = displayedStep;
  }, [displayedStep]);

  // Step-change orchestrator: fade-out → swap (invisible) → wait for
  // blob to finish morphing → fade-in. The wait is a JS timer rather
  // than a Reanimated callback so the timing works even when the new
  // step happens to have the same natural height as the previous one.
  //
  // Phases (ms): 0–180 fade-out, 180–~520 layout + blob morph, 540–760
  // fade-in. The 540ms delay matches fade-out (180) + a small layout
  // buffer (~40) + the blob tween (320).
  useEffect(() => {
    if (step === displayedStepRef.current) return;
    const nextStep = step;
    let cancelled = false;
    contentOpacity.value = withTiming(
      0,
      { duration: 180, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished || cancelled) return;
        runOnJS(setDisplayedStep)(nextStep);
      },
    );
    const fadeInTimer = setTimeout(() => {
      if (cancelled) return;
      contentOpacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }, 540);
    return () => {
      cancelled = true;
      clearTimeout(fadeInTimer);
    };
  }, [step, contentOpacity]);

  const stepContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Reset the wizard *after* the close animation finishes, so the user
  // doesn't see the steps snapping back while the sheet is shrinking.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setStep(1);
      setDisplayedStep(1);
      setMode(null);
      setTemplateId(null);
      setIsGenerating(false);
      contentOpacity.value = 1;
    }, ANIM_DURATION_MS + 80);
    return () => clearTimeout(t);
  }, [open, contentOpacity]);

  // Mount the heavy overlay (backdrop + Skia canvas + content) only when
  // the sheet is actually opening or open. When fully closed we leave
  // *only* the FAB rendered — without this, the absolute-fill wrapper
  // around the Skia canvas was capturing all touches on Android (Fabric
  // doesn't propagate `pointerEvents="box-none"` reliably from the JS
  // side to certain host components, so even with `none` set everywhere
  // the canvas would block the screen).
  const [overlayMounted, setOverlayMounted] = useState(false);
  useEffect(() => {
    if (open) {
      setOverlayMounted(true);
      return;
    }
    const t = setTimeout(
      () => setOverlayMounted(false),
      ANIM_DURATION_MS + 100,
    );
    return () => clearTimeout(t);
  }, [open]);

  // ─── data ────────────────────────────────────────────────────────
  const { templates, isLoading: isLoadingTemplates } = useStoryTemplates();
  const defaultLanguage = ENABLED_LANGUAGES[0];

  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (t) => t.language === null || t.language === defaultLanguage,
      ),
    [templates, defaultLanguage],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // Storytellers are language-scoped. Follow the selected template's
  // language; fall back to the default when no template is chosen yet.
  const storytellerLanguage = selectedTemplate?.language ?? defaultLanguage;
  const { storytellers, isLoading: isLoadingStorytellers } =
    useStorytellers(storytellerLanguage);

  // ─── geometry ────────────────────────────────────────────────────
  const paddingBottom = tabBarPaddingBottom(insets.bottom);
  const buttonCenterX = width / 2;
  const buttonCenterY = height - paddingBottom - TAB_BAR_HEIGHT;
  const buttonRadius = CREATE_BUTTON_RADIUS;
  const fabBottom = paddingBottom + TAB_BAR_HEIGHT - buttonRadius;
  const sheetWidth = width - SHEET_INSET * 2;
  const sheetMaxHeight = height * SHEET_MAX_HEIGHT_RATIO;
  // Inner scroll area in steps 2/3 needs an explicit max so they
  // become scrollable rather than pushing the container past the
  // sheet's max. Header + breathing room ≈ 100 px.
  const stepScrollMaxHeight = sheetMaxHeight - 100;

  // Content's *real* height after layout, driven into the shader so the
  // blob hugs whatever the current step renders. Capped at the sheet's
  // max so a long list still scrolls instead of overgrowing the blob.
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const heightShared = useSharedValue(0);
  useEffect(() => {
    if (measuredHeight <= 0) return;
    heightShared.value = withTiming(Math.min(measuredHeight, sheetMaxHeight), {
      duration: 320,
      easing: Easing.bezier(0.4, 0, 0.1, 1),
    });
  }, [measuredHeight, sheetMaxHeight, heightShared]);

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && Math.abs(h - measuredHeight) > 1) {
        setMeasuredHeight(h);
      }
    },
    [measuredHeight],
  );

  // ─── open/close + FAB morph ──────────────────────────────────────
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: ANIM_DURATION_MS,
    });
  }, [open, progress]);

  // FAB icon morphs between Pen (closed) and Close-X (open). Driven by
  // a single shared value going 0 → 180deg so the two icons spin in
  // lockstep while opacity hands off at the midpoint — Pen fades out
  // over the first half of the rotation, X fades in over the second
  // half. The whole package reads as "the pen flipped over and became
  // a close button" rather than a snap-swap.
  const fabRotation = useSharedValue(0);
  useEffect(() => {
    fabRotation.value = withTiming(open ? 180 : 0, {
      duration: 380,
      easing: Easing.bezier(0.4, 0, 0.1, 1),
    });
  }, [open, fabRotation]);
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));
  const penOpacityStyle = useAnimatedStyle(() => {
    const t = fabRotation.value / 180; // 0..1
    return { opacity: Math.max(1 - t * 2, 0) };
  });
  const closeOpacityStyle = useAnimatedStyle(() => {
    const t = fabRotation.value / 180;
    return { opacity: Math.max(t * 2 - 1, 0) };
  });

  const handleFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
    onToggle();
  };

  // ─── shader uniforms ────────────────────────────────────────────
  const sheetColor =
    scheme === 'dark'
      ? ([0.13, 0.13, 0.16, 1] as [number, number, number, number])
      : ([1, 1, 1, 1] as [number, number, number, number]);

  const uniforms = useDerivedValue(() => ({
    u_progress: progress.value,
    u_resolution: [width, height] as [number, number],
    u_buttonCenter: [buttonCenterX, buttonCenterY] as [number, number],
    u_buttonRadius: buttonRadius,
    u_sheetWidth: sheetWidth,
    // Blob's rectangle height comes from the live content measurement;
    // before the first layout fires we fall back to the max so the
    // first open frame doesn't draw a too-small bubble.
    u_sheetHeight: heightShared.value > 0 ? heightShared.value : sheetMaxHeight,
    u_sheetCornerRadius: SHEET_CORNER_RADIUS,
    u_smoothK: BLOB_SMOOTH_K,
    u_color: sheetColor,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.45,
  }));

  const contentStyle = useAnimatedStyle(() => {
    const t = Math.max((progress.value - 0.55) / 0.45, 0);
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }],
    };
  });

  // ─── selection handlers ─────────────────────────────────────────
  const handlePickMode = (m: BookMode) => {
    Haptics.selectionAsync().catch(() => undefined);
    setMode(m);
    setStep(2);
  };

  const handlePickTemplate = (t: StoryTemplate) => {
    Haptics.selectionAsync().catch(() => undefined);
    setTemplateId(t.id);
    setStep(3);
  };

  const handlePickStoryteller = async (s: Storyteller) => {
    if (!mode || !templateId || isGenerating) return;
    Haptics.selectionAsync().catch(() => undefined);
    setIsGenerating(true);
    try {
      const created = await create({
        mode,
        templateId,
        // Backend keys storytellers by `identifier` (slug), not the
        // database UUID — same as the imagine screen does.
        storyteller: s.identifier,
        language: storytellerLanguage,
      });
      onClose();
      // `push` (not `replace`) so back from the book lands on the tab
      // the user came from — `replace` would swap the tabs route out
      // of the stack and leave no entry for the navigator to pop to.
      router.push(`/book/${created.id}` as Href);
    } catch (e) {
      Alert.alert(
        'Generation failed',
        e instanceof Error ? e.message : 'Unknown error',
      );
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    if (step <= 1) return;
    Haptics.selectionAsync().catch(() => undefined);
    setStep((s) => (s - 1) as Step);
  };

  return (
    <>
      {/* Heavy overlay — backdrop + Skia blob + content — only mounts
          while the sheet is active. When idle the wrapper is gone so
          its absolute-fill geometry can't intercept touches on Android,
          where `pointerEvents="box-none"` propagation through Fabric to
          Skia's `<Canvas>` is unreliable. The FAB rendered below stays
          mounted at all times. */}
      {overlayMounted ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              backdropStyle,
              { backgroundColor: '#000', pointerEvents: 'none' },
            ]}
          />

          {open ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityLabel="Close adventure sheet"
            />
          ) : null}

          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          >
            <Canvas
              style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
              pointerEvents="none"
            >
              <Fill>
                <Shader source={BLOB_SHADER} uniforms={uniforms} />
              </Fill>
            </Canvas>
          </View>

          <Animated.View
            onLayout={handleContainerLayout}
            pointerEvents={open ? 'auto' : 'none'}
            style={[
              {
                position: 'absolute',
                left: SHEET_INSET + 16,
                right: SHEET_INSET + 16,
                // Bottom edge sits on top of the FAB — matches the
                // shader's rect bottom (`u_buttonCenter.y - u_buttonRadius`)
                // so the container's outline aligns with the blob's
                // top edge instead of poking through it. Internal
                // padding pushes content inward off the blob's rim.
                bottom: height - (buttonCenterY - buttonRadius),
                maxHeight: sheetMaxHeight,
                paddingTop: 28,
                paddingBottom: 28,
                paddingHorizontal: 20,
                pointerEvents: open ? 'auto' : 'none',
              },
              contentStyle,
            ]}
          >
            <SheetHeader
              step={displayedStep}
              onBack={step > 1 && !isGenerating ? handleBack : undefined}
            />

            {/* The whole step block fades via `stepContentStyle`.
                `displayedStep` lags behind `step` during the swap, so
                what gets rendered here changes only when content is at
                opacity 0 (in-flight transition). When the user has
                picked a narrator we replace the list with a spinner
                so it's clear something is happening while the AI
                generates the cover/first page. */}
            <Animated.View style={stepContentStyle}>
              {isGenerating ? (
                <GeneratingState />
              ) : (
                <>
                  {displayedStep === 1 ? (
                    <ModeStep selected={mode} onPick={handlePickMode} />
                  ) : null}
                  {displayedStep === 2 ? (
                    <TemplateStep
                      templates={visibleTemplates}
                      isLoading={isLoadingTemplates}
                      onPick={handlePickTemplate}
                      onClose={onClose}
                      maxHeight={stepScrollMaxHeight}
                    />
                  ) : null}
                  {displayedStep === 3 ? (
                    <StorytellerStep
                      storytellers={storytellers}
                      isLoading={isLoadingStorytellers}
                      onPick={handlePickStoryteller}
                      maxHeight={stepScrollMaxHeight}
                    />
                  ) : null}
                </>
              )}
            </Animated.View>
          </Animated.View>
        </>
      ) : null}

      {/* FAB belongs to the tab bar visually — only mount it when the
          tab bar itself is on screen. While the sheet is opening or
          open we keep mounting it so the tap-to-close gesture and the
          + → × morph stay reachable until the close animation finishes
          (after which the overlay unmounts and `open` is false again). */}
      {isOnTab || open ? (
        <Pressable
          onPress={handleFabPress}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close adventure sheet' : 'New story'}
          accessibilityState={{ expanded: open }}
          style={[styles.fab, { bottom: fabBottom }]}
        >
          <Animated.View style={[styles.fabIconStack, fabIconStyle]}>
            <Animated.View style={[styles.fabIconLayer, penOpacityStyle]}>
              <PenIcon size={26} color="white" />
            </Animated.View>
            <Animated.View style={[styles.fabIconLayer, closeOpacityStyle]}>
              <MaterialCommunityIcons name="close" size={26} color="#ffffff" />
            </Animated.View>
          </Animated.View>
        </Pressable>
      ) : null}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function SheetHeader({
  step,
  onBack,
}: {
  step: Step;
  onBack: (() => void) | undefined;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color={undefined}
            />
          </Pressable>
        ) : null}
      </View>
      <ThemedText
        className="text-xl font-black text-black dark:text-white"
        numberOfLines={1}
      >
        {STEP_TITLES[step]}
      </ThemedText>
      {/* Spacer matching the back button slot so the title stays
          centred regardless of whether the back button is shown. */}
      <View style={styles.headerSide} />
    </View>
  );
}

function ModeStep({
  selected,
  onPick,
}: {
  selected: BookMode | null;
  onPick: (mode: BookMode) => void;
}) {
  return (
    <View className="flex-1 items-center justify-center">
      <View className="flex-row flex-wrap justify-center gap-3 px-2">
        <ModeCard
          icon="book-open-page-variant-outline"
          label="Classic"
          description="A linear story read straight through"
          selected={selected === 'classic'}
          onPress={() => onPick('classic')}
        />
        <ModeCard
          icon="puzzle-outline"
          label="Interactive"
          description="Pick what happens next at each page"
          selected={selected === 'interactive'}
          onPress={() => onPick('interactive')}
        />
        <ModeCard
          icon="magic-staff"
          label="Magic"
          description="A linear story with a puzzle inside"
          selected={selected === 'magic'}
          onPress={() => onPick('magic')}
        />
      </View>
    </View>
  );
}

function ModeCard({
  icon,
  label,
  description,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={cn(
        'w-32 h-36 rounded-3xl items-center justify-center p-3',
        'bg-gray-50 dark:bg-zinc-800',
        selected && 'bg-purple-100 dark:bg-purple-900/40',
      )}
    >
      <MaterialCommunityIcons
        name={icon}
        size={36}
        color={selected ? '#7c3aed' : '#52525b'}
      />
      <ThemedText className="text-base font-bold mt-2 text-black dark:text-white">
        {label}
      </ThemedText>
      <ThemedText
        className="text-xs text-gray-500 dark:text-zinc-400 mt-1 text-center"
        numberOfLines={2}
      >
        {description}
      </ThemedText>
    </Pressable>
  );
}

function TemplateStep({
  templates,
  isLoading,
  onPick,
  onClose,
  maxHeight,
}: {
  templates: StoryTemplate[];
  isLoading: boolean;
  onPick: (t: StoryTemplate) => void;
  onClose: () => void;
  /** Maximum height for the inner scrollable list (px). */
  maxHeight: number;
}) {
  if (isLoading) return <LoadingState message="Loading templates…" />;
  if (templates.length === 0) {
    return (
      <View className="items-center px-6">
        <ThemedText className="text-base text-gray-500 dark:text-zinc-400 text-center mb-4">
          You don't have any templates yet.
        </ThemedText>
        <Pressable
          onPress={() => {
            onClose();
            router.push('/settings/templates' as Href);
          }}
          className="rounded-2xl bg-purple-600 px-5 py-3"
        >
          <ThemedText className="text-white font-semibold">
            Create a template
          </ThemedText>
        </Pressable>
      </View>
    );
  }
  return (
    <ScrollView
      // ScrollView with an explicit `maxHeight` takes its content height
      // when small (so the sheet hugs short lists) and caps + scrolls
      // when long. Without it, ScrollView's natural height is unbounded
      // and the sheet would always render at its absolute max.
      style={{ maxHeight }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      {templates.map((tpl) => (
        <Pressable
          key={tpl.id}
          onPress={() => onPick(tpl)}
          className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 mb-2"
        >
          <ThemedText
            className="text-base font-bold text-black dark:text-white"
            numberOfLines={1}
          >
            {tpl.title}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function StorytellerStep({
  storytellers,
  isLoading,
  onPick,
  maxHeight,
}: {
  storytellers: Storyteller[];
  isLoading: boolean;
  onPick: (s: Storyteller) => void;
  maxHeight: number;
}) {
  if (isLoading) return <LoadingState message="Loading narrators…" />;
  if (storytellers.length === 0) {
    return (
      <ThemedText className="text-center text-gray-500 dark:text-zinc-400">
        No narrators available for this language.
      </ThemedText>
    );
  }
  return (
    <ScrollView
      style={{ maxHeight }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      {storytellers.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => onPick(s)}
          className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-3 mb-2 flex-row items-center"
        >
          <Image
            source={{ uri: s.imageUrl }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            contentFit="cover"
          />
          <ThemedText className="text-base font-bold text-black dark:text-white ml-3 flex-1">
            {s.name}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <ThemedText className="text-center text-gray-500 dark:text-zinc-400">
      {message}
    </ThemedText>
  );
}

function GeneratingState() {
  return (
    <View className="py-6 items-center gap-3">
      <ActivityIndicator />
      <ThemedText className="text-base text-gray-600 dark:text-zinc-300 text-center">
        Imagining your adventure…
      </ThemedText>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: CREATE_BUTTON_RADIUS * 2,
    height: CREATE_BUTTON_RADIUS * 2,
    borderRadius: CREATE_BUTTON_RADIUS,
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    zIndex: 10,
    elevation: 12,
  },
  // Square container that holds the two stacked icons so they can
  // rotate as a unit and crossfade without affecting the FAB's circle.
  fabIconStack: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconLayer: {
    position: 'absolute',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerSide: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
});
