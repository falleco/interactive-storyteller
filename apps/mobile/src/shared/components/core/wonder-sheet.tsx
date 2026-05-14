import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type StoryTemplate,
  useStoryTemplates,
} from '~/features/story-templates';
import { ENABLED_LANGUAGES } from '~/features/storytellers';
import { ThemedText } from '~/shared/components/themed-text';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';
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
 * from 0 (closed) to 1 (open). At progress 0 only the circle is visible;
 * at 1 we get a tall pill connected to the FAB with a soft, organic
 * waist where they join. Inspired by Candillon's Reflectly tab sheet.
 */
// `Skia.RuntimeEffect.Make` returns `SkRuntimeEffect | null` (null only on
// compile error). The module-level throw below would still satisfy TS's
// flow analysis, but Skia's `<Shader source>` prop is invariant — easier
// to assert here so the narrowed type flows everywhere it's used.
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
  // Skip entirely when the sheet is closed — otherwise the SDF circle
  // at the FAB position would paint over the purple button even at rest.
  if (u_progress < 0.005) return half4(0.0, 0.0, 0.0, 0.0);
  float circle = sdCircle(fragCoord - u_buttonCenter, u_buttonRadius);

  float halfW = u_sheetWidth * 0.5;
  float halfH = u_sheetHeight * u_progress * 0.5;
  // Position the rectangle so its bottom edge sits just above the
  // button when fully open. Subtracting halfH puts the centre that
  // many pixels above the button's top edge — at progress 0 halfH is 0
  // and the rectangle collapses into the circle, so smin just returns
  // the circle.
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
const BLOB_SHADER = SHADER_SOURCE; // narrowed non-null for Skia's invariant prop

interface WonderSheetProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function WonderSheet({ open, onClose, onToggle }: WonderSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scheme = useColorScheme();
  const { templates, isLoading } = useStoryTemplates();

  // Match the imagine screen's filter: show templates whose `language` is
  // null (universal) or matches the default language. Same default used
  // there (`ENABLED_LANGUAGES[0]`) so the lists stay in sync; once we add
  // a persisted language preference the two should both read from it.
  const defaultLanguage = ENABLED_LANGUAGES[0];
  const visibleTemplates = useMemo(
    () =>
      templates.filter(
        (t) => t.language === null || t.language === defaultLanguage,
      ),
    [templates, defaultLanguage],
  );

  // Recompute the FAB's absolute screen position from the same geometry
  // the tab-bar uses, so the blob's circle anchor stays glued to the
  // button regardless of safe-area / orientation changes.
  const paddingBottom = tabBarPaddingBottom(insets.bottom);
  const buttonCenterX = width / 2;
  const buttonCenterY = height - paddingBottom - TAB_BAR_HEIGHT;
  const buttonRadius = CREATE_BUTTON_RADIUS;
  // Mirror the tab-bar's `createButtonBottom` calc so the FAB renders
  // at the exact same y as it used to inside the tab-bar — but now from
  // here, on top of the Skia blob.
  const fabBottom = paddingBottom + TAB_BAR_HEIGHT - buttonRadius;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: ANIM_DURATION_MS,
    });
  }, [open, progress]);

  // Drive the + → × morph from the same `open` so it stays in sync with
  // the blob's grow/shrink.
  const fabRotation = useSharedValue(0);
  useEffect(() => {
    fabRotation.value = withTiming(open ? 45 : 0, {
      duration: 320,
      easing: Easing.bezier(0.4, 0, 0.1, 1),
    });
  }, [open, fabRotation]);
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));

  const handleFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => undefined,
    );
    onToggle();
  };

  const sheetWidth = width - SHEET_INSET * 2;
  const sheetMaxHeight = height * SHEET_MAX_HEIGHT_RATIO;
  // RGBA, 0..1 — must be a vec4 the shader can read directly.
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
    u_sheetHeight: sheetMaxHeight,
    u_sheetCornerRadius: SHEET_CORNER_RADIUS,
    u_smoothK: BLOB_SMOOTH_K,
    u_color: sheetColor,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.45,
  }));

  // Fade the content in only once the blob is mostly grown, so text
  // doesn't pop into a half-formed shape.
  const contentStyle = useAnimatedStyle(() => {
    const t = Math.max((progress.value - 0.55) / 0.45, 0);
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 12 }],
    };
  });

  const handlePick = (template: StoryTemplate) => {
    onClose();
    router.push(`/imagine?templateId=${template.id}` as Href);
  };

  return (
    // box-none so taps pass through to the underlying tab bar / screens
    // when the sheet is closed; the elements below opt in to receiving
    // touches via their own `pointerEvents`.
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Dim backdrop (visual only) + a separate Pressable that
          intercepts taps to close. Both are gated on `open`. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          backdropStyle,
          { backgroundColor: '#000' },
        ]}
      />
      {open ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close adventure sheet"
        />
      ) : null}

      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill>
          <Shader source={BLOB_SHADER} uniforms={uniforms} />
        </Fill>
      </Canvas>

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            left: SHEET_INSET + 16,
            right: SHEET_INSET + 16,
            top: Math.max(insets.top + 12, buttonCenterY - sheetMaxHeight + 28),
            bottom:
              height - (buttonCenterY - buttonRadius) + SHEET_CORNER_RADIUS / 2,
          },
          contentStyle,
        ]}
      >
        <ThemedText
          className="text-2xl font-black text-center mb-4 text-black dark:text-white"
          numberOfLines={1}
        >
          New adventure
        </ThemedText>

        {isLoading ? (
          <LoadingState />
        ) : visibleTemplates.length === 0 ? (
          <EmptyState onClose={onClose} />
        ) : (
          <TemplateList templates={visibleTemplates} onPick={handlePick} />
        )}
      </Animated.View>

      {/* The FAB has moved out of the tab bar so it can sit visually
          ON TOP of the blob — otherwise the white blob would cover the
          purple button. Tap toggles the sheet via the host context. */}
      <Pressable
        onPress={handleFabPress}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close adventure sheet' : 'New story'}
        accessibilityState={{ expanded: open }}
        style={[fabStyles.fab, { bottom: fabBottom }]}
      >
        <Animated.View style={fabIconStyle}>
          <MaterialCommunityIcons name="plus" color="#ffffff" size={30} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const fabStyles = StyleSheet.create({
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
});

function LoadingState() {
  return (
    <ThemedText className="text-center text-gray-500 dark:text-zinc-400">
      Loading templates…
    </ThemedText>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
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

function TemplateList({
  templates,
  onPick,
}: {
  templates: StoryTemplate[];
  onPick: (t: StoryTemplate) => void;
}) {
  return (
    <ScrollView
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
          {tpl.description ? (
            <ThemedText
              className="text-sm text-gray-500 dark:text-zinc-400 mt-1"
              numberOfLines={2}
            >
              {tpl.description}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}
