import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { shapePlans } from "../shaping.js";

export function registerPlanReadTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_list_plans",
    {
      title: "List YNAB plans",
      description:
        "List available YNAB plans. Call this first when you need a plan_id for other YNAB tools.",
      inputSchema: {},
      annotations: { ...readOnlyAnnotations, title: "List YNAB plans" },
    },
    () => ynabResult(ynab.listPlans(), shapePlans),
  );
}
