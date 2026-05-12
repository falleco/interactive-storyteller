import type { CurrencyTransaction } from '~/data/types';
import {
  getTransactionHistory,
  getTransactionSummary,
  getUserBalance,
  hasSufficientBalance,
} from '~/domain/currency';
import { addGoldenShards } from '~/domain/challenges';

const CURRENCY_COLUMN = 'golden_note_shards';

/**
 * Currency service keeps storage-specific knowledge isolated from hooks/components.
 */
export const currencyService = {
  /**
   * Retrieve the current balance for the provided user.
   */
  async getBalance(userId: string) {
    return getUserBalance(userId, CURRENCY_COLUMN);
  },

  /**
   * Apply a credit/debit operation for the user.
   */
  async modifyBalance(userId: string, amount: number, description?: string) {
    return addGoldenShards(userId, amount, description);
  },

  /**
   * Fetch paginated transaction history.
   */
  async getHistory(userId: string, limit = 20): Promise<CurrencyTransaction[]> {
    return getTransactionHistory(userId, {
      currencyType: CURRENCY_COLUMN,
      limit,
    });
  },

  /**
   * Summaries for dashboard widgets.
   */
  async getSummary(userId: string) {
    return getTransactionSummary(userId, CURRENCY_COLUMN);
  },

  /**
   * Determine if the user has enough shards.
   */
  async hasEnough(userId: string, amount: number) {
    return hasSufficientBalance(userId, amount, CURRENCY_COLUMN);
  },
};

export type CurrencyService = typeof currencyService;
export type { CurrencyTransaction };
