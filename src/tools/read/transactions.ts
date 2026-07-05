import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { accountId, categoryId, date, month, planId, readPayeeId, readTransactionId, resultLimit } from "../schemas.js";
import { shapeTransaction, shapeTransactions, type TransactionFilters } from "../shaping.js";

export function registerTransactionReadTools(server: McpServer, ynab: YnabClient): void {
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
        account_id: accountId.optional().describe("Optional account ID filter."),
        category_id: categoryId.optional().describe("Optional category ID filter."),
        limit: resultLimit,
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
      inputSchema: { plan_id: planId, category_id: categoryId, limit: resultLimit },
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
      inputSchema: { plan_id: planId, account_id: accountId, limit: resultLimit },
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
      inputSchema: { plan_id: planId, payee_id: readPayeeId, limit: resultLimit },
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
      inputSchema: { plan_id: planId, month, limit: resultLimit },
      annotations: { ...readOnlyAnnotations, title: "List YNAB month transactions" },
    },
    ({ plan_id, month: monthValue, limit }) =>
      ynabResult(ynab.listMonthTransactions(plan_id, monthValue), (response) => shapeTransactions(response, { limit })),
  );

  server.registerTool(
    "ynab_get_transaction",
    {
      title: "Get YNAB transaction",
      description: "Get one YNAB transaction by ID for a plan.",
      inputSchema: {
        plan_id: planId,
        transaction_id: readTransactionId.describe("Transaction ID returned by ynab_search_transactions or transaction list tools."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB transaction" },
    },
    ({ plan_id, transaction_id }) =>
      ynabResult(ynab.getTransaction(plan_id, transaction_id), shapeTransaction),
  );
}
