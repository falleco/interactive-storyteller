import { useContext } from 'react';
import { useAuth } from '~/shared/hooks/use-auth';
import {
  type CurrencyTransaction,
  currencyService,
} from '~/features/currency/services/currency-service';
import { GameContext } from '~/features/game/state/game-context';
import type { UserCurrency } from '~/shared/types/music';

export interface UseCurrencyReturn {
  /** User's current currency */
  currency: UserCurrency;
  /** Loading state */
  isLoading: boolean;
  /** Refresh currency data */
  refresh: () => Promise<void>;
  /** Add golden note shards directly */
  addGoldenShards: (amount: number, description?: string) => Promise<void>;
  /** Get transaction history */
  getHistory: (limit?: number) => Promise<CurrencyTransaction[]>;
  /** Get transaction summary */
  getSummary: () => Promise<{
    balance: number;
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
  }>;
  /** Check if user has sufficient balance */
  hasSufficientBalance: (amount: number) => Promise<boolean>;
}

/**
 * Custom hook for managing user currency (Golden Note Shards)
 *
 * This hook implements all currency-related business logic:
 * - Loading currency data
 * - Adding/deducting shards
 * - Transaction history
 * - Balance checking
 *
 * State is managed centrally in GameContext, this hook provides
 * the business logic and operations.
 *
 * @returns Object containing currency state and management functions
 *
 * @example
 * ```tsx
 * const {
 *   currency,
 *   isLoading,
 *   addGoldenShards,
 *   hasSufficientBalance,
 *   getHistory
 * } = useCurrency();
 *
 * // Check balance
 * console.log(`Balance: ${currency.goldenNoteShards}`);
 *
 * // Check if can afford item
 * const canAfford = await hasSufficientBalance(50);
 *
 * // Add shards (admin/testing)
 * await addGoldenShards(100, 'Bonus shards');
 *
 * // View transaction history
 * const history = await getHistory(20);
 * ```
 */
export function useCurrency(): UseCurrencyReturn {
  const context = useContext(GameContext);
  const { user } = useAuth();

  if (!context) {
    throw new Error('useCurrency must be used within a GameProvider');
  }

  const { currency, currencyLoading, setCurrency, setCurrencyLoading } =
    context;

  /**
   * Refreshes currency data from database
   */
  const refresh = async () => {
    if (!user) return;

    try {
      setCurrencyLoading(true);
      const balance = await currencyService.getBalance(user.id);
      setCurrency({ goldenNoteShards: balance });
    } catch (error) {
      console.error('Error refreshing currency:', error);
    } finally {
      setCurrencyLoading(false);
    }
  };

  /**
   * Adds golden note shards directly to user's account
   * @param amount - Amount of shards to add (positive) or deduct (negative)
   * @param description - Optional description for the transaction
   */
  const addGoldenShards = async (amount: number, description?: string) => {
    if (!user) return;

    try {
      await currencyService.modifyBalance(user.id, amount, description);
      await refresh();
    } catch (error) {
      console.error('Error adding golden shards:', error);
      throw error;
    }
  };

  /**
   * Gets transaction history for the user
   * @param limit - Number of transactions to fetch (default: 20)
   */
  const getHistory = async (limit = 20): Promise<CurrencyTransaction[]> => {
    if (!user) return [];

    try {
      return await currencyService.getHistory(user.id, limit);
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return [];
    }
  };

  /**
   * Gets transaction summary for the user
   */
  const getSummary = async () => {
    if (!user) {
      return {
        balance: 0,
        totalCredits: 0,
        totalDebits: 0,
        transactionCount: 0,
      };
    }

    try {
      return await currencyService.getSummary(user.id);
    } catch (error) {
      console.error('Error getting transaction summary:', error);
      return {
        balance: 0,
        totalCredits: 0,
        totalDebits: 0,
        transactionCount: 0,
      };
    }
  };

  /**
   * Checks if user has sufficient balance
   * @param amount - Amount to check
   */
  const hasSufficientBalance = async (amount: number): Promise<boolean> => {
    if (!user) return false;

    try {
      return await currencyService.hasEnough(user.id, amount);
    } catch (error) {
      console.error('Error checking balance:', error);
      return false;
    }
  };

  return {
    currency,
    isLoading: currencyLoading,
    refresh,
    addGoldenShards,
    getHistory,
    getSummary,
    hasSufficientBalance,
  };
}
