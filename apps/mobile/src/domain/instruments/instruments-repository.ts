import {
  InstrumentType,
  type Instrument,
  type InstrumentRarity,
} from '~/shared/types/music';
import { INSTRUMENT_SEEDS } from '~/data/seeds';
import { getUserData, updateUserData } from '~/data/storage/user-data-store';
import { addCurrencyTransaction, getUserBalance } from '../currency/currency-repository';
import { getUserProfile } from '../user/user-profile-repository';

const MAX_LEVEL = 10;
const MAX_TUNING = 100;
const TUNING_INCREMENT = 15;

function getInstrumentSeed(instrumentId: string) {
  const seed = INSTRUMENT_SEEDS.find((item) => item.id === instrumentId);
  if (!seed) {
    throw new Error(`Instrument with id "${instrumentId}" not found`);
  }
  return seed;
}

function calculateInstrumentStats(seed: (typeof INSTRUMENT_SEEDS)[number], level: number) {
  const levelOffset = Math.max(0, level - 1);
  return {
    scoreMultiplier: Number(
      (seed.baseScoreMultiplier + levelOffset * 0.1).toFixed(2),
    ),
    accuracyBonus: seed.baseAccuracyBonus + levelOffset * 2,
    streakBonus: seed.baseStreakBonus + levelOffset,
    upgradePrice: Math.floor(seed.upgradePrice * Math.pow(1.5, levelOffset)),
  };
}

function determineInstrumentType(preferred?: InstrumentType | null): InstrumentType {
  const fallback: InstrumentType = InstrumentType.VIOLIN;
  const type = preferred ?? fallback;
  const exists = INSTRUMENT_SEEDS.some((seed) => seed.type === type);
  return exists ? type : fallback;
}

/**
 * Fetches instruments available for the user's preferred path.
 */
export async function fetchUserInstruments(userId: string): Promise<Instrument[]> {
  const profile = await getUserProfile(userId);
  let userData = await getUserData(userId);
  const instrumentType = determineInstrumentType(
    profile.preferred_instrument as InstrumentType | null,
  );

  const starterId = `${instrumentType}-apprentice`;
  const starterSeed =
    INSTRUMENT_SEEDS.find((item) => item.id === starterId) ||
    INSTRUMENT_SEEDS.find((item) => item.id === 'violin-apprentice');

  if (starterSeed && !userData.instruments[starterSeed.id]?.isOwned) {
    await updateUserData(userId, (data) => {
      data.instruments[starterSeed.id] = {
        level: starterSeed.baseLevel,
        tuning: starterSeed.baseTuning,
        isOwned: true,
        isEquipped: true,
      };
    });
    userData = await getUserData(userId);
  }

  return INSTRUMENT_SEEDS.filter((seed) => seed.type === instrumentType).map(
    (seed) => {
      const state = userData.instruments[seed.id];
      const level = state?.level ?? seed.baseLevel;
      const stats = calculateInstrumentStats(seed, level);
      const tuning = state?.tuning ?? seed.baseTuning;

      return {
        id: seed.id,
        name: seed.name,
        type: seed.type as InstrumentType,
        rarity: seed.rarity as InstrumentRarity,
        level,
        tuning,
        bonuses: {
          scoreMultiplier: stats.scoreMultiplier,
          accuracyBonus: stats.accuracyBonus,
          streakBonus: stats.streakBonus,
        },
        price: seed.price,
        upgradePrice: stats.upgradePrice,
        tunePrice: seed.tunePrice,
        icon: seed.icon,
        description: seed.description,
        isOwned: state?.isOwned ?? false,
        isEquipped: state?.isEquipped ?? false,
      } satisfies Instrument;
    },
  );
}

/**
 * Purchases an instrument for the user.
 */
export async function purchaseInstrument(
  userId: string,
  instrumentId: string,
): Promise<void> {
  const seed = getInstrumentSeed(instrumentId);
  const userData = await getUserData(userId);
  const state = userData.instruments[instrumentId];

  if (state?.isOwned) {
    throw new Error('Instrument already owned');
  }

  const balance = await getUserBalance(userId);
  if (balance < seed.price) {
    throw new Error('Insufficient balance');
  }

  await addCurrencyTransaction(userId, -seed.price, 'purchase', {
    sourceId: instrumentId,
    description: `Purchased instrument: ${seed.name}`,
    metadata: { instrumentId, price: seed.price },
  });

  await updateUserData(userId, (data) => {
    data.instruments[instrumentId] = {
      level: seed.baseLevel,
      tuning: seed.baseTuning,
      isOwned: true,
      isEquipped: false,
    };
  });
}

/**
 * Upgrades an owned instrument.
 */
export async function upgradeInstrument(
  userId: string,
  instrumentId: string,
): Promise<void> {
  const seed = getInstrumentSeed(instrumentId);
  const userData = await getUserData(userId);
  const state = userData.instruments[instrumentId];

  if (!state?.isOwned) {
    throw new Error('Instrument not owned');
  }

  if (state.level >= MAX_LEVEL) {
    throw new Error('Instrument already at max level');
  }

  const stats = calculateInstrumentStats(seed, state.level);
  const upgradePrice = stats.upgradePrice;
  const balance = await getUserBalance(userId);

  if (balance < upgradePrice) {
    throw new Error('Insufficient balance');
  }

  await addCurrencyTransaction(userId, -upgradePrice, 'purchase', {
    sourceId: instrumentId,
    description: `Upgraded instrument: ${seed.name} to level ${state.level + 1}`,
    metadata: {
      instrumentId,
      fromLevel: state.level,
      toLevel: state.level + 1,
      price: upgradePrice,
    },
  });

  await updateUserData(userId, (data) => {
    const current = data.instruments[instrumentId];
    if (current) {
      current.level += 1;
    }
  });
}

/**
 * Tunes an owned instrument.
 */
export async function tuneInstrument(
  userId: string,
  instrumentId: string,
): Promise<void> {
  const seed = getInstrumentSeed(instrumentId);
  const userData = await getUserData(userId);
  const state = userData.instruments[instrumentId];

  if (!state?.isOwned) {
    throw new Error('Instrument not owned');
  }

  if (state.tuning >= MAX_TUNING) {
    throw new Error('Instrument already perfectly tuned');
  }

  const balance = await getUserBalance(userId);
  if (balance < seed.tunePrice) {
    throw new Error('Insufficient balance');
  }

  await addCurrencyTransaction(userId, -seed.tunePrice, 'purchase', {
    sourceId: instrumentId,
    description: `Tuned instrument: ${seed.name}`,
    metadata: {
      instrumentId,
      fromTuning: state.tuning,
      price: seed.tunePrice,
    },
  });

  await updateUserData(userId, (data) => {
    const current = data.instruments[instrumentId];
    if (current) {
      current.tuning = Math.min(MAX_TUNING, current.tuning + TUNING_INCREMENT);
    }
  });
}

function toggleInstrumentState(
  userId: string,
  instrumentId: string,
  equip: boolean,
) {
  return updateUserData(userId, (data) => {
    const current = data.instruments[instrumentId];
    if (!current?.isOwned) {
      throw new Error('Instrument not owned');
    }

    if (equip) {
      for (const state of Object.values(data.instruments)) {
        state.isEquipped = false;
      }
      current.isEquipped = true;
    } else {
      current.isEquipped = false;
    }
  });
}

/**
 * Equips an instrument.
 */
export async function equipInstrument(
  userId: string,
  instrumentId: string,
): Promise<void> {
  await toggleInstrumentState(userId, instrumentId, true);
}

/**
 * Unequips an instrument.
 */
export async function unequipInstrument(
  userId: string,
  instrumentId: string,
): Promise<void> {
  await toggleInstrumentState(userId, instrumentId, false);
}

/**
 * Initializes instrument for a new user (gives starter instrument).
 */
export async function initializeUserInstrument(userId: string): Promise<void> {
  const profile = await getUserProfile(userId);
  const instrumentType = determineInstrumentType(
    profile.preferred_instrument as InstrumentType | null,
  );

  const starterId = `${instrumentType}-apprentice`;
  const seed =
    INSTRUMENT_SEEDS.find((item) => item.id === starterId) ||
    INSTRUMENT_SEEDS.find((item) => item.id === 'violin-apprentice');

  if (!seed) {
    return;
  }

  await updateUserData(userId, (data) => {
    data.instruments[seed.id] = {
      level: seed.baseLevel,
      tuning: seed.baseTuning,
      isOwned: true,
      isEquipped: true,
    };
  });
}

/**
 * Resets all user instruments (for testing).
 */
export async function resetUserInstrument(userId: string): Promise<void> {
  await updateUserData(userId, (data) => {
    data.instruments = {};
  });

  await initializeUserInstrument(userId);
}
