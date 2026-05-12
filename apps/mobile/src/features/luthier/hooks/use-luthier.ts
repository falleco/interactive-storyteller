import { useContext } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import { currencyService } from '~/features/currency/services/currency-service';
import { GameContext } from '~/features/game/state/game-context';
import { luthierService } from '~/features/luthier/services/luthier-service';
import type { Instrument, UserCurrency } from '~/shared/types/music';

export interface UseLuthierReturn {
  /** Available instruments in the shop */
  instruments: Instrument[];
  /** Loading state */
  isLoading: boolean;
  /** Currently equipped instrument */
  equippedInstrument: Instrument | null;
  /** User's owned instruments */
  ownedInstruments: Instrument[];
  /** Purchase an instrument */
  buyInstrument: (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ) => Promise<boolean>;
  /** Upgrade an owned instrument */
  upgradeInstrument: (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ) => Promise<boolean>;
  /** Tune an owned instrument */
  tuneInstrument: (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ) => Promise<boolean>;
  /** Equip an owned instrument */
  equipInstrument: (instrumentId: string) => Promise<void>;
  /** Unequip an owned instrument */
  unequipInstrument: (instrumentId: string) => Promise<void>;
  /** Reset instruments to default (for testing) */
  resetInstruments: () => Promise<void>;
  /** Refresh instruments data */
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing luthier services and instruments
 *
 * This hook implements all instrument-related business logic:
 * - Loading instruments
 * - Purchasing/upgrading/tuning instruments
 * - Equipping/unequipping instruments
 *
 * State is managed centrally in GameContext, this hook provides
 * the business logic and operations.
 *
 * @returns Object containing instruments and luthier service functions
 *
 * @example
 * ```tsx
 * const {
 *   instruments,
 *   equippedInstrument,
 *   buyInstrument,
 *   upgradeInstrument,
 *   tuneInstrument
 * } = useLuthier();
 *
 * // Buy an instrument
 * const success = await buyInstrument('acoustic-guitar', currency, updateCurrency);
 *
 * // Upgrade current instrument
 * await upgradeInstrument('violin-apprentice', currency, updateCurrency);
 *
 * // Tune instrument
 * await tuneInstrument('violin-apprentice', currency, updateCurrency);
 * ```
 */
export function useLuthier(): UseLuthierReturn {
  const context = useContext(GameContext);
  const { user } = useAuth();

  if (!context) {
    throw new Error('useLuthier must be used within a GameProvider');
  }

  const {
    instruments,
    instrumentsLoading,
    setInstruments,
    setInstrumentsLoading,
    setCurrency,
    setCurrencyLoading,
  } = context;

  /**
   * Refreshes instruments data from database
   */
  const refresh = async () => {
    if (!user) return;

    try {
      setInstrumentsLoading(true);
      const fetchedInstruments = await luthierService.getUserInstruments(
        user.id,
      );
      setInstruments(fetchedInstruments);
    } catch (error) {
      console.error('Error refreshing instruments:', error);
    } finally {
      setInstrumentsLoading(false);
    }
  };

  const equippedInstrument =
    instruments.find((instrument) => instrument.isEquipped) || null;
  const ownedInstruments = instruments.filter(
    (instrument) => instrument.isOwned,
  );

  /**
   * Purchases an instrument if user has enough currency
   * @param instrumentId - ID of the instrument to purchase
   * @param currency - Current user currency
   * @param updateCurrency - Function to update user currency
   * @returns True if purchase was successful
   */
  const buyInstrument = async (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const instrument = instruments.find((i) => i.id === instrumentId);
    if (!instrument || instrument.isOwned) {
      return false;
    }

    if (currency.goldenNoteShards < instrument.price) {
      return false; // Not enough currency
    }

    try {
      // Purchase via API (automatically deducts currency)
      await luthierService.purchase(user.id, instrumentId);

      // Refresh instruments
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
      console.error('Error buying instrument:', error);
      return false;
    }
  };

  /**
   * Upgrades an owned instrument
   * @param instrumentId - ID of the instrument to upgrade
   * @param currency - Current user currency
   * @param updateCurrency - Function to update user currency
   * @returns True if upgrade was successful
   */
  const upgradeInstrument = async (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const instrument = instruments.find((i) => i.id === instrumentId);
    if (!instrument || !instrument.isOwned || instrument.level >= 10) {
      return false; // Not owned or max level
    }

    if (currency.goldenNoteShards < instrument.upgradePrice) {
      return false; // Not enough currency
    }

    try {
      // Upgrade via API (automatically deducts currency)
      await luthierService.upgrade(user.id, instrumentId);

      // Refresh instruments
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
      console.error('Error upgrading instrument:', error);
      return false;
    }
  };

  /**
   * Tunes an owned instrument to improve its condition
   * @param instrumentId - ID of the instrument to tune
   * @param currency - Current user currency
   * @param updateCurrency - Function to update user currency
   * @returns True if tuning was successful
   */
  const tuneInstrument = async (
    instrumentId: string,
    currency: UserCurrency,
    updateCurrency: (currency: UserCurrency) => Promise<void>,
  ): Promise<boolean> => {
    if (!user) return false;

    const instrument = instruments.find((i) => i.id === instrumentId);
    if (!instrument || !instrument.isOwned || instrument.tuning >= 100) {
      return false; // Not owned or already perfectly tuned
    }

    if (currency.goldenNoteShards < instrument.tunePrice) {
      return false; // Not enough currency
    }

    try {
      // Tune via API (automatically deducts currency)
      await luthierService.tune(user.id, instrumentId);

      // Refresh instruments
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
      console.error('Error tuning instrument:', error);
      return false;
    }
  };

  /**
   * Equips an owned instrument
   * @param instrumentId - ID of the instrument to equip
   */
  const equipInstrument = async (instrumentId: string) => {
    if (!user) return;

    const instrument = instruments.find((i) => i.id === instrumentId);
    if (!instrument || !instrument.isOwned) {
      return;
    }

    try {
      await luthierService.equip(user.id, instrumentId);
      await refresh();
    } catch (error) {
      console.error('Error equipping instrument:', error);
      throw error;
    }
  };

  /**
   * Unequips an owned instrument
   * @param instrumentId - ID of the instrument to unequip
   */
  const unequipInstrument = async (instrumentId: string) => {
    if (!user) return;

    const instrument = instruments.find((i) => i.id === instrumentId);
    if (!instrument || !instrument.isEquipped) {
      return;
    }

    try {
      await luthierService.equip(user.id, instrumentId);
      await refresh();
    } catch (error) {
      console.error('Error unequipping instrument:', error);
      throw error;
    }
  };

  /**
   * Resets instruments to default state (for testing)
   */
  const resetInstruments = async () => {
    if (!user) return;

    try {
      await luthierService.reset(user.id);
      await refresh();
    } catch (error) {
      console.error('Error resetting instruments:', error);
      throw error;
    }
  };

  return {
    instruments,
    isLoading: instrumentsLoading,
    equippedInstrument,
    ownedInstruments,
    buyInstrument,
    upgradeInstrument,
    tuneInstrument,
    equipInstrument,
    unequipInstrument,
    resetInstruments,
    refresh,
  };
}
