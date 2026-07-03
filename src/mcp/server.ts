import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { registerReadTools } from "../tools/readTools.js";
import { registerWriteTools } from "../tools/writeTools.js";

export function createMcpServer(ynab: YnabClient): McpServer {
  const server = new McpServer(
    { name: "ynab-mcp", version: "0.1.0" },
    {
      instructions:
        "Use ynab_list_plans to discover plan_id values before calling plan-specific tools. Write tools mutate YNAB data; inspect category/account/transaction IDs with read tools first.",
    },
  );

  registerReadTools(server, ynab);
  registerWriteTools(server, ynab);
  return server;
}
