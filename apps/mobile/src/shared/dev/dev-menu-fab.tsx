import * as Clipboard from 'expo-clipboard';
import { useSegments } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ApiError, resolveApiBaseURL, useApi } from '~/shared/api';
import { QaToolIcon } from '~/shared/components/icons/qa-tool-icon';
import { ThemedText } from '~/shared/components/themed-text';
import { useAuth } from '~/shared/hooks/use-auth';
import { useColorSchemeContext } from '~/shared/theme/color-scheme-context';

const FAB_SIZE = 44;
const EDGE_PADDING = 8;
const MENU_WIDTH = 260;
const SNAP_DAMPING = 20;
const Z_INDEX = 9999;

interface MeResponse {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
}

export function DevMenuFab() {
  if (!__DEV__) return null;
  return <DevMenuFabInner />;
}

function DevMenuFabInner() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const api = useApi();
  const { user, bearerToken } = useAuth();
  const { scheme, toggle: toggleTheme } = useColorSchemeContext();
  const segments = useSegments();
  const apiBaseURL = useMemo(() => resolveApiBaseURL(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [status, setStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const translateX = useSharedValue(screenWidth - FAB_SIZE - EDGE_PADDING);
  const translateY = useSharedValue(screenHeight * 0.5);
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((current) => !current);
  const updateDockSide = (x: number) => {
    setDockSide(x < screenWidth / 2 ? 'left' : 'right');
  };

  const logContext = () => {
    const payload = {
      apiBaseURL,
      route: segments.join('/'),
      theme: scheme,
      signedIn: Boolean(user),
      user: user ? { id: user.id, email: user.email, name: user.name } : null,
      bearerToken: bearerToken ? 'present' : 'missing',
    };
    console.log('[dev-menu] app context:', payload);
    setStatus('Context logged to Metro');
    closeMenu();
  };

  const copyBearerToken = async () => {
    if (!bearerToken) {
      setStatus('No bearer token');
      closeMenu();
      return;
    }
    await Clipboard.setStringAsync(bearerToken);
    console.log('[dev-menu] bearer token copied to clipboard');
    setStatus('Bearer token copied');
    closeMenu();
  };

  const logBearerToken = () => {
    console.log('[dev-menu] bearer token:', bearerToken ?? null);
    setStatus(bearerToken ? 'Bearer token logged' : 'No bearer token');
    closeMenu();
  };

  const pingMe = async () => {
    if (!bearerToken) {
      setStatus('GET /me skipped: no bearer token');
      closeMenu();
      return;
    }
    setIsPinging(true);
    try {
      const me = await api.get<MeResponse>('/me');
      console.log('[dev-menu] GET /me ->', me);
      setStatus('GET /me logged');
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('[dev-menu] GET /me failed:', {
          status: error.status,
          code: error.code,
          message: error.message,
          body: error.body,
        });
        setStatus(`GET /me failed: ${error.status}`);
      } else {
        console.error('[dev-menu] GET /me failed:', error);
        setStatus('GET /me failed');
      }
    } finally {
      setIsPinging(false);
      closeMenu();
    }
  };

  const handleToggleTheme = (x: number, y: number) => {
    console.log('[dev-menu] toggle theme:', {
      from: scheme,
      origin: { x, y },
    });
    toggleTheme(x, y);
    setStatus('Theme toggle triggered');
    closeMenu();
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      offsetX.value = translateX.value;
      offsetY.value = translateY.value;
      scale.value = withSpring(1.15, { damping: SNAP_DAMPING });
    })
    .onUpdate((event) => {
      translateX.value = Math.max(
        EDGE_PADDING,
        Math.min(
          offsetX.value + event.translationX,
          screenWidth - FAB_SIZE - EDGE_PADDING,
        ),
      );
      translateY.value = Math.max(
        EDGE_PADDING,
        Math.min(
          offsetY.value + event.translationY,
          screenHeight - FAB_SIZE - EDGE_PADDING,
        ),
      );
    })
    .onEnd(() => {
      isDragging.value = false;
      scale.value = withSpring(1, { damping: SNAP_DAMPING });

      const snapToLeft = translateX.value < screenWidth / 2;
      translateX.value = withSpring(
        snapToLeft ? EDGE_PADDING : screenWidth - FAB_SIZE - EDGE_PADDING,
        { damping: SNAP_DAMPING },
      );
      runOnJS(updateDockSide)(translateX.value);
    });

  const tapGesture = Gesture.Tap().onEnd((_event, success) => {
    if (success && !isDragging.value) {
      runOnJS(toggleMenu)();
    }
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: isDragging.value ? 1 : 0.7,
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: FAB_SIZE,
          height: FAB_SIZE,
          zIndex: Z_INDEX,
        },
        animatedStyle,
      ]}
    >
      {isOpen ? (
        <View
          className="absolute rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          style={{
            width: MENU_WIDTH,
            bottom: FAB_SIZE + 8,
            left: dockSide === 'left' ? 0 : FAB_SIZE - MENU_WIDTH,
          }}
        >
          <ThemedText className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Debug actions
          </ThemedText>
          <DevMenuAction label="Log app context" onPress={logContext} />
          <DevMenuAction
            label="GET /me and log"
            onPress={pingMe}
            disabled={isPinging || !bearerToken}
          />
          <DevMenuAction
            label="Copy bearer token"
            onPress={copyBearerToken}
            disabled={!bearerToken}
          />
          <DevMenuAction label="Log bearer token" onPress={logBearerToken} />
          <DevMenuAction
            label={`Toggle ${scheme === 'dark' ? 'light' : 'dark'} theme`}
            onPress={({ nativeEvent }) =>
              handleToggleTheme(nativeEvent.pageX, nativeEvent.pageY)
            }
          />
          {status ? (
            <ThemedText className="px-2 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {status}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Debug actions"
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: '#111',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <ThemedText
            style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}
          >
            <QaToolIcon size={24} color="N5" />
          </ThemedText>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

type DevMenuActionProps = {
  label: string;
  disabled?: boolean;
  onPress: React.ComponentProps<typeof Pressable>['onPress'];
};

function DevMenuAction({ label, disabled, onPress }: DevMenuActionProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 justify-center rounded-md px-2 active:bg-zinc-100 disabled:opacity-40 dark:active:bg-zinc-900"
    >
      <ThemedText className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {label}
      </ThemedText>
    </Pressable>
  );
}
