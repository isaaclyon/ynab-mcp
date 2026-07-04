import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { planId, readPayeeId } from "../schemas.js";
import { shapePayee, shapePayees } from "../shaping.js";

export function registerPayeeReadTools(server: McpServer, ynab: YnabClient): void {
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
        payee_id: readPayeeId,
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB payee" },
    },
    ({ plan_id, payee_id }) => ynabResult(ynab.getPayee(plan_id, payee_id), shapePayee),
  );
}
