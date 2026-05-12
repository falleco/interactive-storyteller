import { Stack } from 'expo-router';

export default function LuthierLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="purchase"
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
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
