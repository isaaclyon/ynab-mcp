import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { jsonResult } from "./result.js";
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
  shapeTransaction,
  shapeTransactions,
  type TransactionFilters,
} from "./shaping.js";

const planId = z.string().min(1).describe("YNAB plan ID returned by ynab_list_plans.");
const month = z
  .string()
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
    async () => jsonResult(shapePlans(await ynab.listPlans())),
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
    async ({ plan_id, include_closed }) =>
      jsonResult(shapeAccounts(await ynab.listAccounts(plan_id), include_closed)),
  );

  server.registerTool(
    "ynab_list_categories",
    {
      title: "List YNAB categories",
      description: "List category groups and categories for a YNAB plan, including category IDs and balances.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB categories" },
    },
    async ({ plan_id }) => jsonResult(shapeCategories(await ynab.listCategories(plan_id))),
  );

  server.registerTool(
    "ynab_get_category",
    {
      title: "Get YNAB category",
      description: "Get one category by ID, including balances, note, and target fields.",
      inputSchema: {
        plan_id: planId,
        category_id: z.string().min(1).describe("Category ID returned by ynab_list_categories."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB category" },
    },
    async ({ plan_id, category_id }) => jsonResult(shapeCategory(await ynab.getCategory(plan_id, category_id))),
  );

  server.registerTool(
    "ynab_list_payees",
    {
      title: "List YNAB payees",
      description: "List payees for a YNAB plan, including stable payee IDs for transaction tools.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB payees" },
    },
    async ({ plan_id }) => jsonResult(shapePayees(await ynab.listPayees(plan_id))),
  );

  server.registerTool(
    "ynab_get_payee",
    {
      title: "Get YNAB payee",
      description: "Get one payee by ID for a YNAB plan.",
      inputSchema: {
        plan_id: planId,
        payee_id: z.string().min(1).describe("Payee ID returned by ynab_list_payees."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB payee" },
    },
    async ({ plan_id, payee_id }) => jsonResult(shapePayee(await ynab.getPayee(plan_id, payee_id))),
  );

  server.registerTool(
    "ynab_list_months",
    {
      title: "List YNAB months",
      description: "List month summaries for a YNAB plan, including month IDs and assigned/activity totals.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB months" },
    },
    async ({ plan_id }) => jsonResult(shapeMonths(await ynab.listMonths(plan_id))),
  );

  server.registerTool(
    "ynab_get_month",
    {
      title: "Get YNAB month",
      description: "Get one month of YNAB plan data, including category budgeted/activity/balance values.",
      inputSchema: { plan_id: planId, month },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month" },
    },
    async ({ plan_id, month: monthValue }) => jsonResult(shapeMonth(await ynab.getMonth(plan_id, monthValue))),
  );

  server.registerTool(
    "ynab_get_month_category",
    {
      title: "Get YNAB month category",
      description: "Get one category's budgeted, activity, and balance values for a specific YNAB month.",
      inputSchema: {
        plan_id: planId,
        month,
        category_id: z.string().min(1).describe("Category ID returned by ynab_list_categories or ynab_get_month."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month category" },
    },
    async ({ plan_id, month: monthValue, category_id }) =>
      jsonResult(shapeMonthCategory(await ynab.getMonthCategory(plan_id, monthValue, category_id))),
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
      return jsonResult(shapeTransactions(await ynab.listTransactions(plan_id, since_date), filters));
    },
  );

  server.registerTool(
    "ynab_get_transaction",
    {
      title: "Get YNAB transaction",
      description: "Get one YNAB transaction by ID for a plan.",
      inputSchema: {
        plan_id: planId,
        transaction_id: z.string().min(1).describe("Transaction ID returned by ynab_search_transactions."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB transaction" },
    },
    async ({ plan_id, transaction_id }) =>
      jsonResult(shapeTransaction(await ynab.getTransaction(plan_id, transaction_id))),
  );
}
