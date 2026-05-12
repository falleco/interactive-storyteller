const N1 = '#131212';

const WHITE = '#EFE5E5';
const NEGATIVE_LIGHT = '#C74E4E';

const hexToRgba = (hex: string, opacity: number) => {
  const [r, g, b] = hex.match(/\w\w/g)?.map((c) => Number.parseInt(c, 16)) || [
    0, 0, 0,
  ];
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const COLORS = {
  surface: N1,
  transparent: 'transparent',
  black: '#0D0C0C',
  primary: '#D10E00',
  primaryDark: '#310400',
  N1,
  N2: '#181717',
  N3: '#201F1F',
  N4: '#292727',
  N5: '#827D7D',
  white: WHITE,
  white2: hexToRgba(WHITE, 0.02),
  white3: hexToRgba(WHITE, 0.03),
  white5: hexToRgba(WHITE, 0.05),
  white10: hexToRgba(WHITE, 0.1),
  white50: hexToRgba(WHITE, 0.5),
  positiveLight: '#45AD74',
  positiveDark: '#358962',
  negativeLight: NEGATIVE_LIGHT,
  negativeDark: '#984545',
  negative10: hexToRgba(NEGATIVE_LIGHT, 0.1),
  transparency20: 'rgba(10, 9, 9, 0.20)',
  transparency70: 'rgba(10, 9, 9, 0.70)',
  surfacePressed: '#BDB3B3',
  baseBlue: '#0000FF',
};

export type ColorType = keyof typeof COLORS;
