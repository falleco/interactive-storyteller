import { Image } from 'expo-image';

const ICON_SIZE = { width: 56, height: 56 };

type IconProps = { color: string };

export const icons = {
  index: (_props: IconProps) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/book.png')}
      style={ICON_SIZE}
    />
  ),
  // Placeholder art — swap when proper "family" tab icon lands.
  family: (_props: IconProps) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/bag_512.png')}
      style={ICON_SIZE}
    />
  ),
  settings: (_props: IconProps) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/settings.png')}
      style={ICON_SIZE}
    />
  ),
};
