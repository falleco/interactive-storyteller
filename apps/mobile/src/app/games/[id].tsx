import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { findGameDefinition } from '~/features/games';
import { ThemedText } from '~/shared/components/themed-text';

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const game = useMemo(() => (id ? findGameDefinition(id) : undefined), [id]);

  if (!game) {
    return (
      <View style={styles.missingScreen}>
        <Stack.Screen
          options={{
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />
        <ThemedText className="text-2xl font-black text-white">
          Game not found
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-12 items-center justify-center rounded-2xl bg-purple-500 px-6"
        >
          <ThemedText className="text-base font-black text-white">
            Back to games
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const GameComponent = game.Component;

  if (!GameComponent || !game.descriptor) {
    return (
      <View style={styles.missingScreen}>
        <Stack.Screen
          options={{
            gestureEnabled: false,
            animation: 'slide_from_right',
          }}
        />
        <ThemedText className="text-2xl font-black text-white">
          Game route not available
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-12 items-center justify-center rounded-2xl bg-purple-500 px-6"
        >
          <ThemedText className="text-base font-black text-white">
            Back to games
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          animation: game.screen?.animation ?? 'slide_from_right',
        }}
      />
      <GameComponent descriptor={game.descriptor} />
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close game"
        hitSlop={8}
        style={[styles.backButton, { top: insets.top + 12 }]}
      >
        <MaterialCommunityIcons name="chevron-left" size={30} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08091c',
  },
  missingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    backgroundColor: '#08091c',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.36)',
    backgroundColor: 'rgba(12, 10, 28, 0.5)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
});
