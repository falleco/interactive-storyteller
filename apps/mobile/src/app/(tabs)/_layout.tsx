import { Tabs } from 'expo-router';
import { TabBar } from '~/shared/components/core/tab-bar';
import { HapticTab } from '~/shared/components/haptic-tab';
import { IconSymbol } from '~/shared/components/ui/icon-symbol';
import { Colors } from '~/shared/constants/theme';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="equipment"
        options={{
          title: 'Tab Two',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="square.stack.3d.up.fill"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="luthier"
        options={{
          title: 'Tab Three',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
