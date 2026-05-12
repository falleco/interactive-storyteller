import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { TabBar } from '~/shared/components/core/tab-bar';
import { HapticTab } from '~/shared/components/haptic-tab';
import { IconSymbol } from '~/shared/components/ui/icon-symbol';
import { Colors } from '~/shared/constants/theme';
import { useColorScheme } from '~/shared/hooks/use-color-scheme';

const audioSource = require('@/assets/music/sad-violin-amp-orchestral-233798.mp3');

export default function TabLayout() {
  const player = useAudioPlayer(audioSource);
  const colorScheme = useColorScheme();

  useEffect(() => {
    // player.seekTo(0);
    // player.loop = true;
    // player.play();
  }, []);

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
          title: 'Bag',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('@/assets/images/hud/combat_512.png')}
              className="w-28 h-28"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="luthier"
        options={{
          headerShown: false,
          title: 'Luthier',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="play.circle.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
