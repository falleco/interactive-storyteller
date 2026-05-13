import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Canvas,
  Circle,
  dist,
  ImageShader,
  makeImageFromView,
  mix,
  type SkImage,
  Image as SkiaImage,
  vec,
} from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import { colorScheme as nwColorScheme } from 'nativewind';
import type { ReactNode, RefObject } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Snapshot-based theme transition, inspired by Telegram's "circular reveal"
 * and William Candillon's tutorial (`can-it-be-done-in-react-native`,
 * season 5). The flow when the user toggles:
 *
 *   1. Capture the current screen with `makeImageFromView` (Skia).
 *   2. Render that snapshot as a full-screen `<SkiaImage>` overlay so the
 *      visible pixels never change while we swap theme classes underneath.
 *   3. Flip NativeWind's colour scheme — children re-render with new
 *      tailwind `dark:` variants, hidden behind the snapshot.
 *   4. Capture again, getting the post-theme snapshot.
 *   5. Animate a circle from the tap point outward, masked with an
 *      `ImageShader` of the new snapshot. The radius grows from 0 to the
 *      farthest screen corner, revealing the new theme.
 *   6. Dismiss both overlays — the live tree is already on the new theme.
 *
 * The persisted preference (`@wondertales/theme-mode`) is in sync so the
 * choice survives relaunches; on the next boot we restore via NativeWind.
 */

export type ColorSchemeName = 'light' | 'dark';

const STORAGE_KEY = '@wondertales/theme-mode';
const TRANSITION_DURATION = 650;
const PRE_SNAPSHOT_FRAME_WAIT_MS = 16;

/**
 * `expo-status-bar` `style` prop semantics: the value is the **text colour**
 * of the status bar, not the theme name. So:
 *   - light theme → `style="dark"`  (dark text on light background)
 *   - dark theme  → `style="light"` (light text on dark background)
 */
type StatusBarStyle = 'light' | 'dark';

function statusStyleFor(scheme: ColorSchemeName): StatusBarStyle {
  return scheme === 'dark' ? 'light' : 'dark';
}

interface InternalState {
  active: boolean;
  scheme: ColorSchemeName;
  /**
   * What `style` prop to feed the StatusBar component. Kept separate from
   * `scheme` so we can delay the flip until the reveal animation is over —
   * otherwise the text colour would mismatch the snapshot during the
   * transition.
   */
  statusBarStyle: StatusBarStyle;
  overlay1: SkImage | null;
  overlay2: SkImage | null;
}

interface ColorSchemeContextValue extends InternalState {
  ref: RefObject<View | null>;
  transition: SharedValue<number>;
  circle: SharedValue<{ x: number; y: number; r: number }>;
  dispatch: (state: InternalState) => void;
}

const ColorSchemeReactContext = createContext<ColorSchemeContextValue | null>(
  null,
);

function reducer(_prev: InternalState, next: InternalState): InternalState {
  return next;
}

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const initialScheme: ColorSchemeName =
  (nwColorScheme.get() as ColorSchemeName | null) ?? 'light';

const initialState: InternalState = {
  active: false,
  scheme: initialScheme,
  statusBarStyle: statusStyleFor(initialScheme),
  overlay1: null,
  overlay2: null,
};

interface Props {
  children: ReactNode;
}

const { width, height } = Dimensions.get('screen');
const corners = [vec(0, 0), vec(width, 0), vec(width, height), vec(0, height)];

export function ColorSchemeProvider({ children }: Props) {
  const ref = useRef<View>(null);
  const circle = useSharedValue({ x: width / 2, y: height / 2, r: 0 });
  const transition = useSharedValue(0);
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore the persisted preference on first mount so the captured scheme
  // matches what the user picked last session.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark') {
        nwColorScheme.set(stored);
        dispatch({
          ...state,
          scheme: stored,
          statusBarStyle: statusStyleFor(stored),
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // We intentionally only run this once.
    // biome-ignore lint/correctness/useExhaustiveDependencies: bootstrap-only effect
  }, []);

  const r = useDerivedValue(() => mix(transition.value, 0, circle.value.r));

  return (
    <View style={styles.root}>
      {/* Status bar style is driven by our state, not by `auto`, so we can
          delay the flip until the reveal animation completes. */}
      <StatusBar style={state.statusBarStyle} />
      <View ref={ref} style={styles.fill} collapsable={false}>
        <ColorSchemeReactContext.Provider
          value={{ ...state, dispatch, ref, transition, circle }}
        >
          {children}
        </ColorSchemeReactContext.Provider>
      </View>
      {/* Overlay canvas — sits above everything and is pointer-event
          transparent so users can keep interacting while it animates. */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <SkiaImage
          image={state.overlay1}
          x={0}
          y={0}
          width={width}
          height={height}
        />
        {state.overlay2 && (
          <Circle c={circle} r={r}>
            <ImageShader
              image={state.overlay2}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="cover"
            />
          </Circle>
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});

/**
 * Read the active scheme and trigger the animated toggle. `toggle(x, y)`
 * is the origin point for the circular reveal — pass the tap coordinates
 * from a Pressable's onPress event.
 */
export function useColorSchemeContext() {
  const ctx = useContext(ColorSchemeReactContext);
  if (!ctx) {
    throw new Error(
      'useColorSchemeContext must be used inside <ColorSchemeProvider>',
    );
  }
  const { scheme, dispatch, ref, transition, circle, active } = ctx;

  const toggle = useCallback(
    async (x: number, y: number) => {
      if (active) return;
      const next: ColorSchemeName = scheme === 'light' ? 'dark' : 'light';
      // While the reveal animates, keep the status-bar text colour matching
      // the OLD theme (what's still visible underneath/around the growing
      // circle). At the very end we flip it to match the new theme.
      const transitionalStatusBarStyle = statusStyleFor(scheme);

      // Reset overlays + record where the circle starts.
      dispatch({
        active: true,
        scheme,
        statusBarStyle: transitionalStatusBarStyle,
        overlay1: null,
        overlay2: null,
      });

      const maxRadius = Math.max(...corners.map((c) => dist(c, { x, y })));
      circle.value = { x, y, r: maxRadius };
      transition.value = 0;

      // 1. Snapshot the current theme.
      const overlay1 = await makeImageFromView(ref as RefObject<View>);

      // 2. Show it as a static overlay — the user no longer sees the live
      //    tree, so we can swap classes underneath.
      dispatch({
        active: true,
        scheme,
        statusBarStyle: transitionalStatusBarStyle,
        overlay1,
        overlay2: null,
      });

      // 3. Switch theme. NativeWind triggers `dark:` variants throughout
      //    the tree.
      await wait(PRE_SNAPSHOT_FRAME_WAIT_MS);
      nwColorScheme.set(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      dispatch({
        active: true,
        scheme: next,
        statusBarStyle: transitionalStatusBarStyle,
        overlay1,
        overlay2: null,
      });

      // 4. Let RN paint the new theme.
      await wait(PRE_SNAPSHOT_FRAME_WAIT_MS);

      // 5. Snapshot the new theme so it can be masked into the growing
      //    circle on top of `overlay1`.
      const overlay2 = await makeImageFromView(ref as RefObject<View>);
      dispatch({
        active: true,
        scheme: next,
        statusBarStyle: transitionalStatusBarStyle,
        overlay1,
        overlay2,
      });

      // Wait for React + Skia to commit the new state before we kick the
      // animation off. On the very first toggle the Canvas hasn't yet
      // mounted the Circle (state.overlay2 just became truthy), and if we
      // started `withTiming` immediately the first frames would draw
      // without the Circle visible — the animation would appear to skip.
      await wait(PRE_SNAPSHOT_FRAME_WAIT_MS);

      // 6. Animate. When the circle covers the screen, we're done.
      transition.value = 0;
      transition.value = withTiming(1, { duration: TRANSITION_DURATION });
      // Let the reveal mostly play out before flipping the status bar so
      // the text colour swaps right as the new theme is fully on screen
      // (not in the middle of the circle expansion).
      await wait(TRANSITION_DURATION + 30);
      dispatch({
        active: false,
        scheme: next,
        statusBarStyle: statusStyleFor(next),
        overlay1: null,
        overlay2: null,
      });
    },
    [active, scheme, dispatch, ref, transition, circle],
  );

  return { scheme, toggle, active };
}
