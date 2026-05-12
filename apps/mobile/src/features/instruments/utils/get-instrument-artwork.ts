import type { ImageSourcePropType } from 'react-native';
import {
  InstrumentRarity,
  InstrumentType,
  type Instrument,
} from '~/shared/types/music';

const violinBeginner = require('@/assets/images/items/violin/beginner.png');
const violinProfessional = require('@/assets/images/items/violin/professional.png');
const violinLegend = require('@/assets/images/items/violin/legend.png');

type InstrumentArtworkMap = Partial<
  Record<InstrumentType, Partial<Record<InstrumentRarity, ImageSourcePropType>>>
>;

const INSTRUMENT_ARTWORK: InstrumentArtworkMap = {
  [InstrumentType.VIOLIN]: {
    [InstrumentRarity.APPRENTICE]: violinBeginner,
    [InstrumentRarity.NORMAL]: violinProfessional,
    [InstrumentRarity.PRO]: violinProfessional,
    [InstrumentRarity.EPIC]: violinLegend,
  },
};

export function getInstrumentArtwork(
  instrument: Instrument,
): ImageSourcePropType | null {
  return (
    INSTRUMENT_ARTWORK[instrument.type]?.[instrument.rarity] ?? null
  );
}
