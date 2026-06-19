import type { ImageProps } from 'expo-image';

export interface TabBarItem {
  label: string;
  source: NonNullable<ImageProps['source']>;
}

export const tabBarItems = {
  games: {
    label: 'Games',
    source: require('../../../assets/images/tabbar/games.png'),
  },
  index: {
    label: 'Stories',
    source: require('../../../assets/images/tabbar/stories.png'),
  },
  family: {
    label: 'Family',
    source: require('../../../assets/images/tabbar/family.png'),
  },
} satisfies Record<string, TabBarItem>;

export type TabBarRouteName = keyof typeof tabBarItems;

export function isTabBarRouteName(name: string): name is TabBarRouteName {
  return name in tabBarItems;
}
