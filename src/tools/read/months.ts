import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { categoryId, month, planId } from "../schemas.js";
import { shapeMonth, shapeMonthCategory, shapeMonths } from "../shaping.js";

export function registerMonthReadTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_list_months",
    {
      title: "List YNAB months",
      description: "List month summaries for a YNAB plan, including month IDs and assigned/activity totals.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB months" },
    },
    ({ plan_id }) => ynabResult(ynab.listMonths(plan_id), shapeMonths),
  );

  server.registerTool(
    "ynab_get_month",
    {
      title: "Get YNAB month",
      description: "Get one month of YNAB plan data, including category budgeted/activity/balance values.",
      inputSchema: { plan_id: planId, month },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month" },
    },
    ({ plan_id, month: monthValue }) => ynabResult(ynab.getMonth(plan_id, monthValue), shapeMonth),
  );

  server.registerTool(
    "ynab_get_month_category",
    {
      title: "Get YNAB month category",
      description: "Get one category's budgeted, activity, and balance values for a specific YNAB month.",
      inputSchema: {
        plan_id: planId,
        month,
        category_id: categoryId.describe("Category ID returned by ynab_list_categories or ynab_get_month."),
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB month category" },
    },
    ({ plan_id, month: monthValue, category_id }) =>
      ynabResult(ynab.getMonthCategory(plan_id, monthValue, category_id), shapeMonthCategory),
  );
}
