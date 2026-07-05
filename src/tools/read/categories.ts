import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { readOnlyAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { categoryId, planId } from "../schemas.js";
import { shapeCategories, shapeCategory } from "../shaping.js";

export function registerCategoryReadTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_list_categories",
    {
      title: "List YNAB categories",
      description:
        "List category groups and categories for a YNAB plan, including category IDs and balances.",
      inputSchema: { plan_id: planId },
      annotations: { ...readOnlyAnnotations, title: "List YNAB categories" },
    },
    ({ plan_id }) => ynabResult(ynab.listCategories(plan_id), shapeCategories),
  );

  server.registerTool(
    "ynab_get_category",
    {
      title: "Get YNAB category",
      description: "Get one category by ID, including balances, note, and target fields.",
      inputSchema: {
        plan_id: planId,
        category_id: categoryId,
      },
      annotations: { ...readOnlyAnnotations, title: "Get YNAB category" },
    },
    ({ plan_id, category_id }) => ynabResult(ynab.getCategory(plan_id, category_id), shapeCategory),
  );
}
