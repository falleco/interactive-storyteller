import type {
  CurrencyTransaction,
  CurrencyType,
  TransactionSource,
} from '~/data/types';
import {
  createId,
  getUserData,
  updateUserData,
} from '~/data/storage/user-data-store';

const DEFAULT_CURRENCY: CurrencyType = 'golden_note_shards';

function calculateBalance(
  transactions: CurrencyTransaction[],
  currencyType: CurrencyType,
): number {
  return transactions
    .filter((transaction) => transaction.currencyType === currencyType)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

/**
 * Gets the current balance for a user.
 */
export async function getUserBalance(
  userId: string,
  currencyType: CurrencyType = DEFAULT_CURRENCY,
): Promise<number> {
  const data = await getUserData(userId);
  return calculateBalance(data.currency.transactions, currencyType);
}

/**
 * Adds a currency transaction.
 */
export async function addCurrencyTransaction(
  userId: string,
  amount: number,
  source: TransactionSource,
  options?: {
    sourceId?: string;
    description?: string;
    metadata?: Record<string, any>;
    currencyType?: CurrencyType;
  },
): Promise<string | null> {
  let newTransactionId: string | null = null;
  const currencyType = options?.currencyType ?? DEFAULT_CURRENCY;

  await updateUserData(userId, (data) => {
    const transaction: CurrencyTransaction = {
      id: createId('txn'),
      userId,
      currencyType,
      amount,
      source,
      sourceId: options?.sourceId,
      description: options?.description,
      metadata: options?.metadata ?? null,
      createdAt: new Date().toISOString(),
    };

    data.currency.transactions = [transaction, ...data.currency.transactions];

    const balance = calculateBalance(data.currency.transactions, currencyType);
    data.profile.golden_note_shards = Math.max(balance, 0);

    newTransactionId = transaction.id;
  });

  return newTransactionId;
}

/**
 * Gets transaction history for a user.
 */
export async function getTransactionHistory(
  userId: string,
  options?: {
    currencyType?: CurrencyType;
    limit?: number;
    offset?: number;
  },
): Promise<CurrencyTransaction[]> {
  const data = await getUserData(userId);
  const currencyType = options?.currencyType ?? DEFAULT_CURRENCY;

  const sorted = [...data.currency.transactions]
    .filter((transaction) => transaction.currencyType === currencyType)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? sorted.length;

  return sorted.slice(offset, offset + limit);
}

/**
 * Gets transaction summary for a user.
 */
export async function getTransactionSummary(
  userId: string,
  currencyType: CurrencyType = DEFAULT_CURRENCY,
): Promise<{
  balance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
}> {
  const data = await getUserData(userId);
  const transactions = data.currency.transactions.filter(
    (transaction) => transaction.currencyType === currencyType,
  );

  const totalCredits = transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const totalDebits = Math.abs(
    transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );

  const balance = calculateBalance(transactions, currencyType);

  return {
    balance,
    totalCredits,
    totalDebits,
    transactionCount: transactions.length,
  };
}

/**
 * Checks if user has sufficient balance.
 */
export async function hasSufficientBalance(
  userId: string,
  requiredAmount: number,
  currencyType: CurrencyType = DEFAULT_CURRENCY,
): Promise<boolean> {
  const balance = await getUserBalance(userId, currencyType);
  return balance >= requiredAmount;
}
