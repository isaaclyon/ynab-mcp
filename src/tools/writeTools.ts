import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { registerCategoryWriteTools } from "./write/categories.js";
import { registerMonthWriteTools } from "./write/months.js";
import { registerPayeeWriteTools } from "./write/payees.js";
import { registerScheduledTransactionWriteTools } from "./write/scheduledTransactions.js";
import { registerTransactionWriteTools } from "./write/transactions.js";

export function registerWriteTools(server: McpServer, ynab: YnabClient): void {
  registerPayeeWriteTools(server, ynab);
  registerCategoryWriteTools(server, ynab);
  registerMonthWriteTools(server, ynab);
  registerTransactionWriteTools(server, ynab);
  registerScheduledTransactionWriteTools(server, ynab);
}
