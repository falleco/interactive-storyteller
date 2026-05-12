import { Image } from 'expo-image';

export const icons = {
  index: (props: any) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/combat_512.png')}
      style={{ width: 56, height: 56 }}
    />
  ),
  equipment: (props: any) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/bag_512.png')}
      style={{ width: 56, height: 56 }}
    />
  ),
  luthier: (props: any) => (
    <Image
      contentFit="cover"
      transition={1000}
      source={require('@/assets/images/hud/shop_512.png')}
      style={{ width: 56, height: 56 }}
    />
  ),
};
