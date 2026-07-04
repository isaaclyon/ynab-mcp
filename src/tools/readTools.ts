import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { registerAccountReadTools } from "./read/accounts.js";
import { registerCategoryReadTools } from "./read/categories.js";
import { registerMonthReadTools } from "./read/months.js";
import { registerPayeeReadTools } from "./read/payees.js";
import { registerPlanReadTools } from "./read/plans.js";
import { registerScheduledTransactionReadTools } from "./read/scheduledTransactions.js";
import { registerTransactionReadTools } from "./read/transactions.js";

export function registerReadTools(server: McpServer, ynab: YnabClient): void {
  registerPlanReadTools(server, ynab);
  registerAccountReadTools(server, ynab);
  registerCategoryReadTools(server, ynab);
  registerPayeeReadTools(server, ynab);
  registerMonthReadTools(server, ynab);
  registerTransactionReadTools(server, ynab);
  registerScheduledTransactionReadTools(server, ynab);
}
