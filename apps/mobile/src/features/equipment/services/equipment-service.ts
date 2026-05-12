import {
  equipItem,
  fetchUserEquipment,
  purchaseEquipment,
  resetUserEquipment,
  unequipItem,
  upgradeEquipment,
} from '~/domain/equipment';
import type { Equipment } from '~/shared/types/music';

/**
 * Equipment service responsible for coordinating persistence operations.
 * Keeping data access in one place makes it easy to evolve storage or
 * introduce caching without touching UI logic.
 */
export const equipmentService = {
  /**
   * Fetch the full equipment catalog for the provided user.
   */
  async getUserEquipment(userId: string): Promise<Equipment[]> {
    return fetchUserEquipment(userId);
  },

  /**
   * Attempt to purchase the equipment item for the current user.
   */
  async purchase(userId: string, equipmentId: string) {
    return purchaseEquipment(userId, equipmentId);
  },

  /**
   * Upgrade the specified equipment item.
   */
  async upgrade(userId: string, equipmentId: string) {
    return upgradeEquipment(userId, equipmentId);
  },

  /**
   * Equip the provided equipment item.
   */
  async equip(userId: string, equipmentId: string) {
    return equipItem(userId, equipmentId);
  },

  /**
   * Unequip the provided equipment item.
   */
  async unequip(userId: string, equipmentId: string) {
    return unequipItem(userId, equipmentId);
  },

  /**
   * Reset all equipment to default values.
   */
  async reset(userId: string) {
    return resetUserEquipment(userId);
  },
};

export type EquipmentService = typeof equipmentService;
