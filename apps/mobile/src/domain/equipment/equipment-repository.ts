import type {
  Equipment,
  EquipmentCategory,
  EquipmentRarity,
  OnboardingInstrument,
} from '~/shared/types/music';
import { EquipmentCategory as EquipmentCategoryEnum } from '~/shared/types/music';
import { EQUIPMENT_SEEDS } from '~/data/seeds';
import { getUserData, updateUserData } from '~/data/storage/user-data-store';
import { addCurrencyTransaction, getUserBalance } from '../currency/currency-repository';
import { getUserProfile } from '../user/user-profile-repository';

const MAX_LEVEL = 10;

function getEquipmentSeed(equipmentId: string) {
  const seed = EQUIPMENT_SEEDS.find((item) => item.id === equipmentId);
  if (!seed) {
    throw new Error(`Equipment with id "${equipmentId}" not found`);
  }
  return seed;
}

function calculateStats(seed: (typeof EQUIPMENT_SEEDS)[number], level: number) {
  const levelOffset = Math.max(0, level - 1);
  return {
    scoreBonus: seed.baseScoreBonus + levelOffset * 25,
    accuracyBonus: seed.baseAccuracyBonus + levelOffset * 2,
    streakBonus: seed.baseStreakBonus + levelOffset,
    upgradePrice: Math.floor(seed.upgradePrice * Math.pow(1.5, levelOffset)),
  };
}

function determinePreferredInstrument(
  preferred?: OnboardingInstrument | null,
): OnboardingInstrument {
  return preferred ?? 'violin';
}

/**
 * Fetches all available equipment with user ownership data.
 */
export async function fetchUserEquipment(userId: string): Promise<Equipment[]> {
  const profile = await getUserProfile(userId);
  let userData = await getUserData(userId);
  const preferredInstrument = determinePreferredInstrument(
    profile.preferred_instrument,
  );

  const starterIds = [
    'novice-cloak',
    `starter-${preferredInstrument}-kit`,
  ];

  const needsStarter = starterIds.some(
    (equipmentId) => !userData.equipment[equipmentId]?.isOwned,
  );

  if (needsStarter) {
    await updateUserData(userId, (data) => {
      for (const equipmentId of starterIds) {
        const seed = EQUIPMENT_SEEDS.find((item) => item.id === equipmentId);
        if (!seed) continue;
        data.equipment[equipmentId] = {
          level: seed.baseLevel,
          isOwned: true,
          isEquipped: true,
        };
      }
    });
    userData = await getUserData(userId);
  }

  return EQUIPMENT_SEEDS.filter((seed) =>
    seed.instrumentType ? seed.instrumentType === preferredInstrument : true,
  ).map((seed) => {
    const state = userData.equipment[seed.id];
    const level = state?.level ?? seed.baseLevel;
    const stats = calculateStats(seed, level);

    return {
      id: seed.id,
      name: seed.name,
      category: seed.category as EquipmentCategory,
      rarity: seed.rarity as EquipmentRarity,
      instrumentType: seed.instrumentType,
      level,
      bonuses: {
        scoreBonus: stats.scoreBonus,
        accuracyBonus: stats.accuracyBonus,
        streakBonus: stats.streakBonus,
        specialEffect: seed.specialEffect ?? undefined,
      },
      price: seed.price,
      upgradePrice: stats.upgradePrice,
      icon: seed.icon,
      description: seed.description,
      isOwned: state?.isOwned ?? false,
      isEquipped: state?.isEquipped ?? false,
    } satisfies Equipment;
  });
}

/**
 * Purchases equipment for a user.
 */
export async function purchaseEquipment(
  userId: string,
  equipmentId: string,
): Promise<void> {
  const seed = getEquipmentSeed(equipmentId);
  const userData = await getUserData(userId);
  const state = userData.equipment[equipmentId];

  if (state?.isOwned) {
    throw new Error('Equipment already owned');
  }

  const balance = await getUserBalance(userId);
  if (balance < seed.price) {
    throw new Error('Insufficient balance');
  }

  await addCurrencyTransaction(userId, -seed.price, 'purchase', {
    sourceId: equipmentId,
    description: `Purchased equipment: ${seed.name}`,
    metadata: { equipmentId, price: seed.price },
  });

  await updateUserData(userId, (data) => {
    data.equipment[equipmentId] = {
      level: seed.baseLevel,
      isOwned: true,
      isEquipped: false,
    };
  });
}

/**
 * Upgrades owned equipment.
 */
export async function upgradeEquipment(
  userId: string,
  equipmentId: string,
): Promise<void> {
  const seed = getEquipmentSeed(equipmentId);
  const userData = await getUserData(userId);
  const state = userData.equipment[equipmentId];

  if (!state?.isOwned) {
    throw new Error('Equipment not owned');
  }

  if (state.level >= MAX_LEVEL) {
    throw new Error('Equipment already at max level');
  }

  const stats = calculateStats(seed, state.level);
  const upgradePrice = stats.upgradePrice;
  const balance = await getUserBalance(userId);

  if (balance < upgradePrice) {
    throw new Error('Insufficient balance');
  }

  await addCurrencyTransaction(userId, -upgradePrice, 'purchase', {
    sourceId: equipmentId,
    description: `Upgraded equipment: ${seed.name} to level ${state.level + 1}`,
    metadata: {
      equipmentId,
      fromLevel: state.level,
      toLevel: state.level + 1,
      price: upgradePrice,
    },
  });

  await updateUserData(userId, (data) => {
    const current = data.equipment[equipmentId];
    if (current) {
      current.level += 1;
    }
  });
}

function updateEquipState(
  userId: string,
  equipmentId: string,
  equip: boolean,
) {
  const seed = getEquipmentSeed(equipmentId);
  return updateUserData(userId, (data) => {
    const current = data.equipment[equipmentId];
    if (!current?.isOwned) {
      throw new Error('Equipment not owned');
    }

    if (equip) {
      if (
        seed.category === EquipmentCategoryEnum.MANTLE ||
        seed.category === EquipmentCategoryEnum.INSTRUMENTS
      ) {
        for (const [id, state] of Object.entries(data.equipment)) {
          const otherSeed = EQUIPMENT_SEEDS.find((item) => item.id === id);
          if (!otherSeed) continue;
          if (
            otherSeed.category === seed.category &&
            id !== equipmentId &&
            state.isEquipped
          ) {
            state.isEquipped = false;
          }
        }
      }
      current.isEquipped = true;
    } else {
      current.isEquipped = false;
    }
  });
}

/**
 * Equips an item.
 */
export async function equipItem(
  userId: string,
  equipmentId: string,
): Promise<void> {
  await updateEquipState(userId, equipmentId, true);
}

/**
 * Unequips an item.
 */
export async function unequipItem(
  userId: string,
  equipmentId: string,
): Promise<void> {
  await updateEquipState(userId, equipmentId, false);
}

/**
 * Initializes equipment for a new user (gives starter equipment).
 */
export async function initializeUserEquipment(userId: string): Promise<void> {
  const profile = await getUserProfile(userId);
  const preferredInstrument = determinePreferredInstrument(
    profile.preferred_instrument,
  );

  const starterIds = [
    'novice-cloak',
    `starter-${preferredInstrument}-kit`,
  ];

  await updateUserData(userId, (data) => {
    for (const equipmentId of starterIds) {
      const seed = EQUIPMENT_SEEDS.find((item) => item.id === equipmentId);
      if (!seed) continue;

      data.equipment[equipmentId] = {
        level: seed.baseLevel,
        isOwned: true,
        isEquipped: true,
      };
    }
  });
}

/**
 * Resets all user equipment (for testing).
 */
export async function resetUserEquipment(userId: string): Promise<void> {
  await updateUserData(userId, (data) => {
    data.equipment = {};
  });

  await initializeUserEquipment(userId);
}
