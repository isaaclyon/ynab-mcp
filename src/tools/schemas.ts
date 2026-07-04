import { z } from "zod";

export const planId = z.string().trim().min(1).describe("YNAB plan ID returned by ynab_list_plans.");
export const accountId = z.string().trim().min(1).describe("Account ID returned by ynab_list_accounts.");
export const categoryId = z.string().trim().min(1).describe("Category ID returned by ynab_list_categories.");
export const categoryGroupId = z.string().trim().min(1).describe("YNAB category group ID returned by ynab_list_categories.");
export const readPayeeId = z.string().trim().min(1).describe("Payee ID returned by ynab_list_payees.");
export const writePayeeId = z.string().min(1).describe("YNAB payee ID returned by ynab_list_payees.");
export const readTransactionId = z.string().trim().min(1).describe("Transaction ID returned by ynab_search_transactions or transaction list tools.");
export const writeTransactionId = z.string().trim().min(1).describe("YNAB transaction ID returned by ynab_search_transactions or transaction list tools.");
export const readScheduledTransactionId = z
  .string()
  .trim()
  .min(1)
  .describe("Scheduled transaction ID returned by ynab_list_scheduled_transactions.");
export const writeScheduledTransactionId = z
  .string()
  .trim()
  .min(1)
  .describe("YNAB scheduled transaction ID returned by ynab_list_scheduled_transactions.");
export const month = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe("Month in YYYY-MM format.");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date in YYYY-MM-DD format.");
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("ISO date in YYYY-MM-DD format.");
export const resultLimit = z.number().int().min(1).max(100).default(25);
