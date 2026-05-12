import {
  equipInstrument,
  fetchUserInstruments,
  purchaseInstrument,
  resetUserInstrument,
  tuneInstrument,
  unequipInstrument,
  upgradeInstrument,
} from '~/domain/instruments';
import type { Instrument } from '~/shared/types/music';

/**
 * Luthier service centralises instrument persistence logic.
 */
export const luthierService = {
  /**
   * Fetch the user's instruments with ownership metadata.
   */
  async getUserInstruments(userId: string): Promise<Instrument[]> {
    return fetchUserInstruments(userId);
  },

  /**
   * Purchase an instrument.
   */
  async purchase(userId: string, instrumentId: string) {
    return purchaseInstrument(userId, instrumentId);
  },

  /**
   * Upgrade an owned instrument.
   */
  async upgrade(userId: string, instrumentId: string) {
    return upgradeInstrument(userId, instrumentId);
  },

  /**
   * Tune an owned instrument.
   */
  async tune(userId: string, instrumentId: string) {
    return tuneInstrument(userId, instrumentId);
  },

  /**
   * Equip an instrument as active.
   */
  async equip(userId: string, instrumentId: string) {
    return equipInstrument(userId, instrumentId);
  },

  /**
   * Unequip the provided instrument.
   */
  async unequip(userId: string, instrumentId: string) {
    return unequipInstrument(userId, instrumentId);
  },

  /**
   * Reset instrument ownership (useful for dev/testing).
   */
  async reset(userId: string) {
    return resetUserInstrument(userId);
  },
};

export type LuthierService = typeof luthierService;
