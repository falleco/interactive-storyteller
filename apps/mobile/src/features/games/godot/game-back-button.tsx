import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUTTON_SIZE = 52;
const SIDE_GAP = 32;
const TOP_GAP = 24;
const MAX_TOP_SAFE_OFFSET = 24;

export function GameBackButton() {
  const insets = useSafeAreaInsets();
  const paddingTop = Math.min(insets.top, MAX_TOP_SAFE_OFFSET) + TOP_GAP;
  const paddingLeft = Math.max(insets.left + SIDE_GAP, SIDE_GAP);

  return (
    <>
      <StatusBar hidden />
      <View pointerEvents="box-none" style={styles.overlay}>
        <View
          pointerEvents="box-none"
          style={[styles.buttonSlot, { paddingTop, paddingLeft }]}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
            ]}
          >
            <View style={styles.buttonSurface}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={38}
                color="#ffffff"
              />
            </View>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    elevation: 50,
  },
  buttonSlot: {
    alignItems: 'flex-start',
    width: '100%',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    shadowColor: '#000000',
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonSurface: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#000000',
    opacity: 1,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
});
