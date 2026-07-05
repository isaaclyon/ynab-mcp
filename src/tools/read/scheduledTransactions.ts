import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { planId, readScheduledTransactionId, resultLimit } from "../schemas.js";
import { shapeScheduledTransaction, shapeScheduledTransactions } from "../shaping.js";

export function registerScheduledTransactionReadTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_list_scheduled_transactions",
    {
      title: "List YNAB scheduled transactions",
      description:
        "List scheduled transactions for a YNAB plan. Returns compact transaction-like records with scheduled transaction IDs.",
      inputSchema: { plan_id: planId, limit: resultLimit },
      annotations: { ...readOnlyAnnotations, title: "List YNAB scheduled transactions" },
    },
    ({ plan_id, limit }) =>
      ynabResult(ynab.listScheduledTransactions(plan_id), (response) =>
        shapeScheduledTransactions(response, limit),
      ),
  );

  server.registerTool(
    "ynab_get_scheduled_transaction",
    {
      title: "Get YNAB scheduled transaction",
      description: "Get one scheduled transaction by ID for a YNAB plan.",
      inputSchema: { plan_id: planId, scheduled_transaction_id: readScheduledTransactionId },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB scheduled transaction" },
    },
    ({ plan_id, scheduled_transaction_id }) =>
      ynabResult(
        ynab.getScheduledTransaction(plan_id, scheduled_transaction_id),
        shapeScheduledTransaction,
      ),
  );
}
