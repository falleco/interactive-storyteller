import { Stack } from 'expo-router';

export default function BagLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="manage"
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
