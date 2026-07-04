import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { planId } from "../schemas.js";
import { shapeAccounts } from "../shaping.js";

export function registerAccountReadTools(server: McpServer, ynab: YnabClient): void {
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
}
