import { useContext } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { currencyService } from '~/features/currency/services/currency-service';
import { equipmentService } from '~/features/equipment/services/equipment-service';
import { GameContext } from '~/features/game/state/game-context';
import type {
  Equipment,
  EquipmentCategory,
  UserCurrency,
  UserEquipment,
} from '~/shared/types/music';

export interface UseEquipmentReturn {
  /** All available equipment */
  equipment: Equipment[];
  /** Loading state */
  isLoading: boolean;
  /** Currently equipped items by category */
  userEquipment: UserEquipment;
  /** Equipment filtered by category */
  getEquipmentByCategory: (category: EquipmentCategory) => Equipment[];
  /** Purchase equipment */
  buyEquipment: (
    equipmentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ) => Promise<boolean>;
  /** Upgrade equipment */
  upgradeEquipment: (
    equipmentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ) => Promise<boolean>;
  /** Equip an item */
  equipItem: (equipmentId: string) => Promise<void>;
  /** Unequip an item */
  unequipItem: (equipmentId: string) => Promise<void>;
  /** Get total bonuses from all equipped items */
  getTotalBonuses: () => {
    scoreBonus: number;
    accuracyBonus: number;
    streakBonus: number;
  };
  /** Reset equipment to default */
  resetEquipment: () => Promise<void>;
  /** Refresh equipment data */
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing equipment system
 *
 * This hook implements all equipment-related business logic:
 * - Loading equipment
 * - Purchasing/upgrading equipment
 * - Equipping/unequipping items
 * - Calculating bonuses
 *
 * State is managed centrally in GameContext, this hook provides
 * the business logic and operations.
 *
 * @returns Object containing equipment data and management functions
 *
 * @example
 * ```tsx
 * const {
 *   equipment,
 *   userEquipment,
 *   getEquipmentByCategory,
 *   buyEquipment,
 *   equipItem
 * } = useEquipment();
 *
 * // Get mantles
 * const mantles = getEquipmentByCategory(EquipmentCategory.MANTLE);
 *
 * // Buy equipment
 * await buyEquipment('silver-pendant', currency, updateCurrency);
 *
 * // Equip item
 * await equipItem('novice-cloak');
 * ```
 */
export function useEquipment(): UseEquipmentReturn {
  const context = useContext(GameContext);
  const { user } = useAuth();

  if (!context) {
    throw new Error('useEquipment must be used within a GameProvider');
  }

  const {
    equipment,
    equipmentLoading,
    setEquipment,
    setEquipmentLoading,
    setCurrency,
    setCurrencyLoading,
  } = context;

  /**
   * Refreshes equipment data from database
   */
  const refresh = async () => {
    if (!user) return;

    try {
      setEquipmentLoading(true);
      const fetchedEquipment = await equipmentService.getUserEquipment(user.id);
      setEquipment(fetchedEquipment);
    } catch (error) {
      console.error('Error refreshing equipment:', error);
    } finally {
      setEquipmentLoading(false);
    }
  };

  /**
   * Gets equipment filtered by category
   */
  const getEquipmentByCategory = (category: EquipmentCategory): Equipment[] => {
    return equipment.filter((item) => item.category === category);
  };

  /**
   * Gets currently equipped items organized by category
   */
  const userEquipment: UserEquipment = {
    mantle:
      equipment.find((e) => e.category === 'mantle' && e.isEquipped) || null,
    adornments: equipment.filter(
      (e) => e.category === 'adornments' && e.isEquipped,
    ),
    instruments:
      equipment.find((e) => e.category === 'instruments' && e.isEquipped) ||
      null,
  };

  /**
   * Purchases equipment if user has enough currency
   */
  const buyEquipment = async (
    equipmentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const item = equipment.find((e) => e.id === equipmentId);
    if (!item || item.isOwned) {
      return false;
    }

    if (currency.goldenNoteShards < item.price) {
      return false;
    }

    try {
      // Purchase via API (automatically deducts currency)
      await equipmentService.purchase(user.id, equipmentId);

      // Refresh equipment
      await refresh();

      // Refresh currency too
      setCurrencyLoading(true);
      const balance = await currencyService.getBalance(user.id);
      const updatedCurrency = { goldenNoteShards: balance };
      setCurrency(updatedCurrency);
      await updateCurrency(updatedCurrency);
      setCurrencyLoading(false);

      return true;
    } catch (error) {
      console.error('Error buying equipment:', error);
      return false;
    }
  };

  /**
   * Upgrades owned equipment
   */
  const upgradeEquipment = async (
    equipmentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const item = equipment.find((e) => e.id === equipmentId);
    if (!item || !item.isOwned || item.level >= 10) {
      return false;
    }

    if (currency.goldenNoteShards < item.upgradePrice) {
      return false;
    }

    try {
      // Upgrade via API (automatically deducts currency)
      await equipmentService.upgrade(user.id, equipmentId);

      // Refresh equipment
      await refresh();

      // Refresh currency too
      setCurrencyLoading(true);
      const balance = await currencyService.getBalance(user.id);
      const updatedCurrency = { goldenNoteShards: balance };
      setCurrency(updatedCurrency);
      await updateCurrency(updatedCurrency);
      setCurrencyLoading(false);

      return true;
    } catch (error) {
      console.error('Error upgrading equipment:', error);
      return false;
    }
  };

  /**
   * Equips an item (handles category-specific logic on server)
   */
  const equipItem = async (equipmentId: string) => {
    if (!user) return;

    const item = equipment.find((e) => e.id === equipmentId);
    if (!item || !item.isOwned) {
      return;
    }

    try {
      await equipmentService.equip(user.id, equipmentId);
      await refresh();
    } catch (error) {
      console.error('Error equipping item:', error);
      throw error;
    }
  };

  /**
   * Unequips an item
   */
  const unequipItem = async (equipmentId: string) => {
    if (!user) return;

    const item = equipment.find((e) => e.id === equipmentId);
    if (!item || !item.isEquipped) {
      return;
    }

    try {
      await equipmentService.unequip(user.id, equipmentId);
      await refresh();
    } catch (error) {
      console.error('Error unequipping item:', error);
      throw error;
    }
  };

  /**
   * Calculates total bonuses from all equipped items
   */
  const getTotalBonuses = () => {
    const totalBonuses = {
      scoreBonus: 0,
      accuracyBonus: 0,
      streakBonus: 0,
    };

    // Add mantle bonuses
    if (userEquipment.mantle) {
      totalBonuses.scoreBonus += userEquipment.mantle.bonuses.scoreBonus;
      totalBonuses.accuracyBonus += userEquipment.mantle.bonuses.accuracyBonus;
      totalBonuses.streakBonus += userEquipment.mantle.bonuses.streakBonus;
    }

    // Add instrument bonuses
    if (userEquipment.instruments) {
      totalBonuses.scoreBonus += userEquipment.instruments.bonuses.scoreBonus;
      totalBonuses.accuracyBonus +=
        userEquipment.instruments.bonuses.accuracyBonus;
      totalBonuses.streakBonus += userEquipment.instruments.bonuses.streakBonus;
    }

    // Add adornment bonuses
    userEquipment.adornments.forEach((adornment) => {
      totalBonuses.scoreBonus += adornment.bonuses.scoreBonus;
      totalBonuses.accuracyBonus += adornment.bonuses.accuracyBonus;
      totalBonuses.streakBonus += adornment.bonuses.streakBonus;
    });

    return totalBonuses;
  };

  /**
   * Resets equipment to default state (for testing)
   */
  const resetEquipment = async () => {
    if (!user) return;

    try {
      await equipmentService.reset(user.id);
      await refresh();
    } catch (error) {
      console.error('Error resetting equipment:', error);
      throw error;
    }
  };

  return {
    equipment,
    isLoading: equipmentLoading,
    userEquipment,
    getEquipmentByCategory,
    buyEquipment,
    upgradeEquipment,
    equipItem,
    unequipItem,
    getTotalBonuses,
    resetEquipment,
    refresh,
  };
}
