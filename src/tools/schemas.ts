import { z } from "zod";
import {
  accountIdSchema,
  categoryGroupIdSchema,
  categoryIdSchema,
  isoDateSchema,
  milliunitsSchema,
  monthSchema,
  payeeIdSchema,
  planIdSchema,
  scheduledTransactionIdSchema,
  transactionIdSchema,
  untrimmedPayeeIdSchema,
} from "../domain/ynabValues.js";

export const planId = planIdSchema.describe("YNAB plan ID returned by ynab_list_plans.");
export const accountId = accountIdSchema.describe("Account ID returned by ynab_list_accounts.");
export const categoryId = categoryIdSchema.describe("Category ID returned by ynab_list_categories.");
export const categoryGroupId = categoryGroupIdSchema.describe("YNAB category group ID returned by ynab_list_categories.");
export const readPayeeId = payeeIdSchema.describe("Payee ID returned by ynab_list_payees.");
export const writePayeeId = untrimmedPayeeIdSchema.describe("YNAB payee ID returned by ynab_list_payees.");
export const readTransactionId = transactionIdSchema.describe("Transaction ID returned by ynab_search_transactions or transaction list tools.");
export const writeTransactionId = transactionIdSchema.describe("YNAB transaction ID returned by ynab_search_transactions or transaction list tools.");
export const readScheduledTransactionId = scheduledTransactionIdSchema.describe(
  "Scheduled transaction ID returned by ynab_list_scheduled_transactions.",
);
export const writeScheduledTransactionId = scheduledTransactionIdSchema.describe(
  "YNAB scheduled transaction ID returned by ynab_list_scheduled_transactions.",
);
export const month = monthSchema.describe("Month in YYYY-MM format.");
export const date = isoDateSchema.describe("Date in YYYY-MM-DD format.");
export const isoDate = isoDateSchema.describe("ISO date in YYYY-MM-DD format.");
export const milliunits = milliunitsSchema.describe("YNAB milliunits amount. For example, $12.34 is 12340.");
export const resultLimit = z.number().int().min(1).max(100).default(25);
