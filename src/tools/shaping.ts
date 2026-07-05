import {
  accountSchema,
  accountsContainerSchema,
  categoriesResponseSchema,
  categoryGroupResponseSchema,
  categoryResponseSchema,
  monthCategoryResponseSchema,
  monthResponseSchema,
  monthsResponseSchema,
  parseYnabResponse,
  payeeResponseSchema,
  payeesResponseSchema,
  plansResponseSchema,
  scheduledTransactionResponseSchema,
  scheduledTransactionWriteResponseSchema,
  scheduledTransactionsContainerSchema,
  scheduledTransactionSchema,
  transactionResponseSchema,
  transactionWriteResponseSchema,
  transactionsContainerSchema,
  transactionSchema,
} from "./ynabResponseSchemas.js";
import type { AccountId, CategoryId } from "../domain/ynabValues.js";

export type JsonRecord = Record<string, unknown>;
export type PlansResult = { plans: JsonRecord[] };
export type AccountsResult = { accounts: JsonRecord[] };
export type CategoryResult = { category: JsonRecord };
export type CategoryGroupResult = { category_group: JsonRecord };
export type CategoriesResult = { category_groups: Array<JsonRecord & { categories: JsonRecord[] }> };
export type PayeesResult = { payees: JsonRecord[] };
export type PayeeResult = { payee: JsonRecord };
export type MonthResult = { month: JsonRecord & { categories: JsonRecord[] } };
export type MonthsResult = { months: JsonRecord[] };
export type TransactionsResult = { transactions: JsonRecord[] };
export type TransactionResult = { transaction: JsonRecord };
export type ScheduledTransactionsResult = { scheduled_transactions: JsonRecord[] };
export type ScheduledTransactionResult = { scheduled_transaction: JsonRecord };

export function shapePlans(response: unknown): PlansResult {
  const parsed = parseYnabResponse(plansResponseSchema, response, "list plans");
  return {
    plans: parsed.data.plans.map((plan) => pick(plan, ["id", "name", "last_modified_on", "currency_format"])),
  };
}

export function shapeAccounts(response: unknown, includeClosed: boolean): AccountsResult {
  const parsed = parseYnabResponse(accountsContainerSchema, response, "list accounts container");
  const emittedAccounts = parsed.data.accounts.filter((account) => !isRecord(account) || includeClosed || account.closed !== true);
  const accounts = parseYnabResponse(accountSchema.array(), emittedAccounts, "list accounts records")
    .map((account) => pick(account, ["id", "name", "type", "on_budget", "closed", "balance", "cleared_balance", "uncleared_balance", "deleted"]));
  return { accounts };
}

export function shapeCategory(response: unknown): CategoryResult {
  const parsed = parseYnabResponse(categoryResponseSchema, response, "category");
  return { category: shapeCategoryRecord(parsed.data.category) };
}

export function shapeCategoryGroup(response: unknown): CategoryGroupResult {
  const parsed = parseYnabResponse(categoryGroupResponseSchema, response, "category group");
  return { category_group: shapeCategoryGroupRecord(parsed.data.category_group) };
}

export function shapeCategories(response: unknown): CategoriesResult {
  const parsed = parseYnabResponse(categoriesResponseSchema, response, "list categories");
  return {
    category_groups: parsed.data.category_groups.map((group) => ({
      ...shapeCategoryGroupRecord(group),
      categories: group.categories.map(shapeCategoryRecord),
    })),
  };
}

export function shapePayees(response: unknown): PayeesResult {
  const parsed = parseYnabResponse(payeesResponseSchema, response, "list payees");
  return { payees: parsed.data.payees.map(shapePayeeRecord) };
}

export function shapePayee(response: unknown): PayeeResult {
  const parsed = parseYnabResponse(payeeResponseSchema, response, "payee");
  return { payee: shapePayeeRecord(parsed.data.payee) };
}

export function shapeMonth(response: unknown): MonthResult {
  const parsed = parseYnabResponse(monthResponseSchema, response, "month");
  return {
    month: {
      ...shapeMonthSummaryRecord(parsed.data.month),
      categories: parsed.data.month.categories.map(shapeMonthCategoryRecord),
    },
  };
}

export function shapeMonths(response: unknown): MonthsResult {
  const parsed = parseYnabResponse(monthsResponseSchema, response, "list months");
  return { months: parsed.data.months.map(shapeMonthSummaryRecord) };
}

export function shapeMonthCategory(response: unknown): CategoryResult {
  const parsed = parseYnabResponse(monthCategoryResponseSchema, response, "month category");
  return { category: shapeMonthCategoryRecord(parsed.data.category) };
}

export function shapeTransactions(response: unknown, filters: TransactionFilters): TransactionsResult {
  const parsed = parseYnabResponse(transactionsContainerSchema, response, "list transactions container");
  const emittedTransactions = parsed.data.transactions
    .filter((transaction) => matchesTransactionFilters(transaction, filters))
    .slice(0, filters.limit);
  const transactions = parseYnabResponse(transactionSchema.array(), emittedTransactions, "list transactions records")
    .map(shapeTransactionRecord);
  return { transactions };
}

export function shapeTransaction(response: unknown): TransactionResult {
  const parsed = parseYnabResponse(transactionResponseSchema, response, "transaction");
  return { transaction: shapeTransactionRecord(parsed.data.transaction) };
}

export function shapeTransactionWrite(response: unknown): TransactionResult {
  const parsed = parseYnabResponse(transactionWriteResponseSchema, response, "transaction write");
  return { transaction: shapeTransactionRecord(parsed.data.transaction) };
}

export function shapeScheduledTransactions(response: unknown, limit: number): ScheduledTransactionsResult {
  const parsed = parseYnabResponse(scheduledTransactionsContainerSchema, response, "list scheduled transactions container");
  const emittedScheduledTransactions = parsed.data.scheduled_transactions.slice(0, limit);
  const scheduledTransactions = parseYnabResponse(
    scheduledTransactionSchema.array(),
    emittedScheduledTransactions,
    "list scheduled transactions records",
  ).map(shapeScheduledTransactionRecord);
  return { scheduled_transactions: scheduledTransactions };
}

export function shapeScheduledTransaction(response: unknown): ScheduledTransactionResult {
  const parsed = parseYnabResponse(scheduledTransactionResponseSchema, response, "scheduled transaction");
  return { scheduled_transaction: shapeScheduledTransactionRecord(parsed.data.scheduled_transaction) };
}

export function shapeScheduledTransactionWrite(response: unknown): ScheduledTransactionResult {
  const parsed = parseYnabResponse(scheduledTransactionWriteResponseSchema, response, "scheduled transaction write");
  return { scheduled_transaction: shapeScheduledTransactionRecord(parsed.data.scheduled_transaction) };
}

export type TransactionFilters = {
  limit: number;
  query?: string;
  accountId?: AccountId;
  categoryId?: CategoryId;
};

function shapeCategoryRecord(category: JsonRecord): JsonRecord {
  return pick(category, [
    "id",
    "category_group_id",
    "category_group_name",
    "name",
    "note",
    "hidden",
    "internal",
    "original_category_group_id",
    "budgeted",
    "activity",
    "balance",
    "goal_type",
    "goal_target",
    "goal_target_date",
    "goal_needs_whole_amount",
    "deleted",
  ]);
}

function shapeCategoryGroupRecord(group: JsonRecord): JsonRecord {
  return pick(group, ["id", "name", "hidden", "internal", "deleted"]);
}

function shapePayeeRecord(payee: JsonRecord): JsonRecord {
  return pick(payee, ["id", "name", "transfer_account_id", "deleted"]);
}

function shapeMonthSummaryRecord(month: JsonRecord): JsonRecord {
  return pick(month, ["month", "note", "income", "budgeted", "activity", "to_be_budgeted", "age_of_money", "deleted"]);
}

function shapeMonthCategoryRecord(category: JsonRecord): JsonRecord {
  return shapeCategoryRecord(category);
}

function shapeTransactionRecord(transaction: JsonRecord): JsonRecord {
  const shaped = pick(transaction, [
    "id",
    "date",
    "amount",
    "memo",
    "cleared",
    "approved",
    "flag_color",
    "account_id",
    "account_name",
    "payee_id",
    "payee_name",
    "category_id",
    "category_name",
    "transfer_account_id",
    "deleted",
  ]);
  const subtransactions = transaction.subtransactions;
  return Array.isArray(subtransactions) && subtransactions.length > 0
    ? { ...shaped, subtransactions: subtransactions.map(shapeSubtransactionRecord) }
    : shaped;
}

function shapeScheduledTransactionRecord(scheduledTransaction: JsonRecord): JsonRecord {
  const shaped = pick(scheduledTransaction, [
    "id",
    "date_first",
    "date_next",
    "amount",
    "memo",
    "flag_color",
    "frequency",
    "account_id",
    "account_name",
    "payee_id",
    "payee_name",
    "category_id",
    "category_name",
    "transfer_account_id",
    "deleted",
  ]);
  const subtransactions = scheduledTransaction.subtransactions;
  return Array.isArray(subtransactions) && subtransactions.length > 0
    ? { ...shaped, subtransactions: subtransactions.map(shapeSubtransactionRecord) }
    : shaped;
}

function shapeSubtransactionRecord(subtransaction: JsonRecord): JsonRecord {
  return pick(subtransaction, [
    "id",
    "transaction_id",
    "amount",
    "memo",
    "payee_id",
    "payee_name",
    "category_id",
    "category_name",
    "transfer_account_id",
    "deleted",
  ]);
}

function matchesTransactionFilters(transaction: unknown, filters: TransactionFilters): boolean {
  if (!isRecord(transaction)) {
    return !filters.accountId && !filters.categoryId && !filters.query;
  }
  return matchesFilters(transaction, filters);
}

function matchesFilters(transaction: JsonRecord, filters: TransactionFilters): boolean {
  if (filters.accountId && transaction.account_id !== filters.accountId) {
    return false;
  }
  if (filters.categoryId && transaction.category_id !== filters.categoryId) {
    return false;
  }
  if (!filters.query) {
    return true;
  }
  const haystack = [transaction.memo, transaction.payee_name, transaction.category_name, transaction.account_name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(filters.query.toLowerCase());
}

function pick(record: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter((key) => key in record).map((key) => [key, record[key]]));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
