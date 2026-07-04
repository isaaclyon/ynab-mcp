import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { updateAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { categoryId, month, planId } from "../schemas.js";
import { shapeMonthCategory } from "../shaping.js";

const budgeted = z
  .number()
  .int()
  .describe("Assigned budget amount in YNAB milliunits for this category month. For example, $12.34 is 12340.");

export function registerMonthWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_update_month_category",
    {
      title: "Update YNAB month category",
      description: "Adjust the budgeted amount assigned to one category for a specific YNAB month.",
      inputSchema: { plan_id: planId, month, category_id: categoryId, budgeted },
      annotations: { ...updateAnnotations, title: "Update YNAB month category" },
    },
    ({ plan_id, month: monthValue, category_id, budgeted: budgetedValue }) =>
      ynabResult(ynab.updateMonthCategory(plan_id, monthValue, category_id, { budgeted: budgetedValue }), shapeMonthCategory),
  );
}
