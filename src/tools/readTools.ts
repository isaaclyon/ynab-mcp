import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { ynabResult } from "./result.js";
import { readOnlyAnnotations } from "./annotations.js";
import {
  shapeAccounts,
  shapeCategory,
  shapeCategories,
  shapeMonth,
  shapeMonthCategory,
  shapeMonths,
  shapePayee,
  shapePayees,
  shapePlans,
  shapeScheduledTransaction,
  shapeScheduledTransactions,
  shapeTransaction,
  shapeTransactions,
  type TransactionFilters,
} from "./shaping.js";

const planId = z.string().trim().min(1).describe("YNAB plan ID returned by ynab_list_plans.");
const accountId = z.string().trim().min(1).describe("Account ID returned by ynab_list_accounts.");
const categoryId = z.string().trim().min(1).describe("Category ID returned by ynab_list_categories.");
const payeeId = z.string().trim().min(1).describe("Payee ID returned by ynab_list_payees.");
const transactionId = z.string().trim().min(1).describe("Transaction ID returned by ynab_search_transactions or transaction list tools.");
const scheduledTransactionId = z
  .string()
  .trim()
  .min(1)
  .describe("Scheduled transaction ID returned by ynab_list_scheduled_transactions.");
const month = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe("Month in YYYY-MM format.");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date in YYYY-MM-DD format.");

export function registerReadTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_list_plans",
    {
      title: "List YNAB plans",
      description: "List available YNAB plans. Call this first when you need a plan_id for other YNAB tools.",
      inputSchema: {},
      annotations: { ...readOnlyAnnotations, title: "List YNAB plans" },
    },
    () => ynabResult(ynab.listPlans(), shapePlans),
  );

  server.registerTool(
    "ynab_list_accounts",
    {
      title: "List YNAB accounts",
      description: "List accounts for a YNAB plan, including IDs and balances needed for follow-up questions.",
      inputSchema: {
        plan_id: planId,
        include_closed: z.boolean().default(false).describe("Whether to include closed accounts."),
      },
      annotations: { ...readOnlyAnnotations, title: "List YNAB accounts" },
    },
    ({ plan_id, include_closed }) =>
      ynabResult(ynab.listAccounts(plan_id), (response) => shapeAccounts(response, include_closed)),
  );

  server.registerTool(
    "ynab_list_categories",
    {
      title: "List YNAB categories",
      description: "List category groups and categories for a YNAB plan, including category IDs and balances.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB categories" },
    },
    ({ plan_id }) => ynabResult(ynab.listCategories(plan_id), shapeCategories),
  );

  server.registerTool(
    "ynab_get_category",
    {
      title: "Get YNAB category",
      description: "Get one category by ID, including balances, note, and target fields.",
      inputSchema: {
        plan_id: planId,
        category_id: categoryId,
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB category" },
    },
    ({ plan_id, category_id }) => ynabResult(ynab.getCategory(plan_id, category_id), shapeCategory),
  );

  server.registerTool(
    "ynab_list_payees",
    {
      title: "List YNAB payees",
      description: "List payees for a YNAB plan, including stable payee IDs for transaction tools.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB payees" },
    },
    ({ plan_id }) => ynabResult(ynab.listPayees(plan_id), shapePayees),
  );

  server.registerTool(
    "ynab_get_payee",
    {
      title: "Get YNAB payee",
      description: "Get one payee by ID for a YNAB plan.",
      inputSchema: {
        plan_id: planId,
        payee_id: payeeId,
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB payee" },
    },
    ({ plan_id, payee_id }) => ynabResult(ynab.getPayee(plan_id, payee_id), shapePayee),
  );

  server.registerTool(
    "ynab_list_months",
    {
      title: "List YNAB months",
      description: "List month summaries for a YNAB plan, including month IDs and assigned/activity totals.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB months" },
    },
    ({ plan_id }) => ynabResult(ynab.listMonths(plan_id), shapeMonths),
  );

  server.registerTool(
    "ynab_get_month",
    {
      title: "Get YNAB month",
      description: "Get one month of YNAB plan data, including category budgeted/activity/balance values.",
      inputSchema: { plan_id: planId, month },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month" },
    },
    ({ plan_id, month: monthValue }) => ynabResult(ynab.getMonth(plan_id, monthValue), shapeMonth),
  );

  server.registerTool(
    "ynab_get_month_category",
    {
      title: "Get YNAB month category",
      description: "Get one category's budgeted, activity, and balance values for a specific YNAB month.",
      inputSchema: {
        plan_id: planId,
        month,
        category_id: categoryId.describe("Category ID returned by ynab_list_categories or ynab_get_month."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month category" },
    },
    ({ plan_id, month: monthValue, category_id }) =>
      ynabResult(ynab.getMonthCategory(plan_id, monthValue, category_id), shapeMonthCategory),
  );

  server.registerTool(
    "ynab_search_transactions",
    {
      title: "Search YNAB transactions",
      description:
        "Search recent YNAB transactions for a plan. Use since_date and filters to keep results focused; returns up to limit compact transaction records.",
      inputSchema: {
        plan_id: planId,
        since_date: date.optional(),
        query: z.string().min(1).max(100).optional().describe("Case-insensitive text matched against memo, payee, category, and account names."),
        account_id: z.string().min(1).optional().describe("Optional account ID filter."),
        category_id: z.string().min(1).optional().describe("Optional category ID filter."),
        limit: z.number().int().min(1).max(100).default(25),
      },
      annotations: { ...readOnlyAnnotations, title: "Search YNAB transactions" },
    },
    async ({ plan_id, since_date, query, account_id, category_id, limit }) => {
      const filters: TransactionFilters = {
        limit,
        ...(query ? { query } : {}),
        ...(account_id ? { accountId: account_id } : {}),
        ...(category_id ? { categoryId: category_id } : {}),
      };
      return ynabResult(ynab.listTransactions(plan_id, since_date), (response) => shapeTransactions(response, filters));
    },
  );

  server.registerTool(
    "ynab_list_category_transactions",
    {
      title: "List YNAB category transactions",
      description: "List transactions assigned to one category in a YNAB plan. Returns compact transaction records.",
      inputSchema: { plan_id: planId, category_id: categoryId, limit: z.number().int().min(1).max(100).default(25) },
      annotations: { ...readOnlyAnnotations, title: "List YNAB category transactions" },
    },
    ({ plan_id, category_id, limit }) =>
      ynabResult(ynab.listCategoryTransactions(plan_id, category_id), (response) => shapeTransactions(response, { limit })),
  );

  server.registerTool(
    "ynab_list_account_transactions",
    {
      title: "List YNAB account transactions",
      description: "List transactions for one account in a YNAB plan. Returns compact transaction records.",
      inputSchema: { plan_id: planId, account_id: accountId, limit: z.number().int().min(1).max(100).default(25) },
      annotations: { ...readOnlyAnnotations, title: "List YNAB account transactions" },
    },
    ({ plan_id, account_id, limit }) =>
      ynabResult(ynab.listAccountTransactions(plan_id, account_id), (response) => shapeTransactions(response, { limit })),
  );

  server.registerTool(
    "ynab_list_payee_transactions",
    {
      title: "List YNAB payee transactions",
      description: "List transactions for one payee in a YNAB plan. Returns compact transaction records.",
      inputSchema: { plan_id: planId, payee_id: payeeId, limit: z.number().int().min(1).max(100).default(25) },
      annotations: { ...readOnlyAnnotations, title: "List YNAB payee transactions" },
    },
    ({ plan_id, payee_id, limit }) =>
      ynabResult(ynab.listPayeeTransactions(plan_id, payee_id), (response) => shapeTransactions(response, { limit })),
  );

  server.registerTool(
    "ynab_list_month_transactions",
    {
      title: "List YNAB month transactions",
      description: "List transactions for one YYYY-MM month in a YNAB plan. Returns compact transaction records.",
      inputSchema: { plan_id: planId, month, limit: z.number().int().min(1).max(100).default(25) },
      annotations: { ...readOnlyAnnotations, title: "List YNAB month transactions" },
    },
    ({ plan_id, month: monthValue, limit }) =>
      ynabResult(ynab.listMonthTransactions(plan_id, monthValue), (response) => shapeTransactions(response, { limit })),
  );

  server.registerTool(
    "ynab_list_scheduled_transactions",
    {
      title: "List YNAB scheduled transactions",
      description: "List scheduled transactions for a YNAB plan. Returns compact transaction-like records with scheduled transaction IDs.",
      inputSchema: { plan_id: planId, limit: z.number().int().min(1).max(100).default(25) },
      annotations: { ...readOnlyAnnotations, title: "List YNAB scheduled transactions" },
    },
    ({ plan_id, limit }) =>
      ynabResult(ynab.listScheduledTransactions(plan_id), (response) => shapeScheduledTransactions(response, limit)),
  );

  server.registerTool(
    "ynab_get_scheduled_transaction",
    {
      title: "Get YNAB scheduled transaction",
      description: "Get one scheduled transaction by ID for a YNAB plan.",
      inputSchema: { plan_id: planId, scheduled_transaction_id: scheduledTransactionId },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB scheduled transaction" },
    },
    ({ plan_id, scheduled_transaction_id }) =>
      ynabResult(ynab.getScheduledTransaction(plan_id, scheduled_transaction_id), shapeScheduledTransaction),
  );

  server.registerTool(
    "ynab_get_transaction",
    {
      title: "Get YNAB transaction",
      description: "Get one YNAB transaction by ID for a plan.",
      inputSchema: {
        plan_id: planId,
        transaction_id: transactionId.describe("Transaction ID returned by ynab_search_transactions or transaction list tools."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB transaction" },
    },
    ({ plan_id, transaction_id }) =>
      ynabResult(ynab.getTransaction(plan_id, transaction_id), shapeTransaction),
  );
}
