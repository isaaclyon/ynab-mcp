import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { registerReadTools } from "../tools/readTools.js";

export function createMcpServer(ynab: YnabClient): McpServer {
  const server = new McpServer(
    { name: "ynab-mcp", version: "0.1.0" },
    {
      instructions:
        "Use ynab_list_plans to discover plan_id values before calling plan-specific tools. All exposed YNAB tools are read-only.",
    },
  );

  registerReadTools(server, ynab);
  return server;
}
