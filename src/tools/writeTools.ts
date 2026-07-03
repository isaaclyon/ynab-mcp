import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { createAnnotations, updateAnnotations } from "./annotations.js";
import { jsonResult } from "./result.js";
import { shapeCategory, shapeCategoryGroup } from "./shaping.js";

const planId = z.string().min(1).describe("YNAB plan ID returned by ynab_list_plans.");
const categoryGroupId = z.string().min(1).describe("YNAB category group ID returned by ynab_list_categories.");
const categoryId = z.string().min(1).describe("YNAB category ID returned by ynab_list_categories.");
const categoryName = z.string().min(1).max(50).describe("Category name. YNAB limits names to 50 characters.");
const groupName = z.string().min(1).max(50).describe("Category group name. YNAB limits names to 50 characters.");
const nullableNote = z.string().max(500).nullable().optional().describe("Category note. Pass null to clear an existing note.");
const milliunits = z
  .number()
  .int()
  .nullable()
  .optional()
  .describe("YNAB milliunits amount. For example, $12.34 is 12340. Pass null to remove an existing target.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("ISO date in YYYY-MM-DD format.");
const nullableIsoDate = isoDate
  .nullable()
  .optional()
  .describe("ISO date in YYYY-MM-DD format. Pass null to clear when YNAB supports clearing this field.");
const categoryUpdateFields = {
  name: categoryName.optional().describe("New category name."),
  note: nullableNote,
  category_group_id: categoryGroupId.optional().describe("Move the category to this category group."),
  goal_target: milliunits,
  goal_target_date: nullableIsoDate,
  goal_needs_whole_amount: z
    .boolean()
    .nullable()
    .optional()
    .describe("For NEED goals, whether the full target amount is required each period."),
} as const;

export function registerWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_category_group",
    {
      title: "Create YNAB category group",
      description: "Create a new category group in a YNAB plan. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, name: groupName },
      annotations: { ...createAnnotations, title: "Create YNAB category group" },
    },
    async ({ plan_id, name }) => jsonResult(shapeCategoryGroup(await ynab.createCategoryGroup(plan_id, { name }))),
  );

  server.registerTool(
    "ynab_update_category_group",
    {
      title: "Update YNAB category group",
      description: "Rename an existing YNAB category group. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, category_group_id: categoryGroupId, name: groupName },
      annotations: { ...updateAnnotations, title: "Update YNAB category group" },
    },
    async ({ plan_id, category_group_id, name }) =>
      jsonResult(shapeCategoryGroup(await ynab.updateCategoryGroup(plan_id, category_group_id, { name }))),
  );

  server.registerTool(
    "ynab_create_category",
    {
      title: "Create YNAB category",
      description: "Create a new category in a category group. YNAB does not expose delete for categories.",
      inputSchema: {
        plan_id: planId,
        category_group_id: categoryGroupId,
        name: categoryName,
        note: nullableNote,
        goal_target: milliunits,
        goal_target_date: isoDate.optional(),
        goal_needs_whole_amount: z.boolean().nullable().optional(),
      },
      annotations: { ...createAnnotations, title: "Create YNAB category" },
    },
    async ({ plan_id, category_group_id, name, note, goal_target, goal_target_date, goal_needs_whole_amount }) => {
      validateGoalFields(goal_needs_whole_amount, goal_target, goal_target_date);
      return jsonResult(
        shapeCategory(
          await ynab.createCategory(
            plan_id,
            {
              category_group_id,
              name,
              ...compact({ note, goal_target, goal_target_date, goal_needs_whole_amount }),
            },
          ),
        ),
      );
    },
  );

  server.registerTool(
    "ynab_update_category",
    {
      title: "Update YNAB category",
      description:
        "Update category metadata, move it to another category group, or adjust target fields. YNAB does not expose delete for categories.",
      inputSchema: { plan_id: planId, category_id: categoryId, ...categoryUpdateFields },
      annotations: { ...updateAnnotations, title: "Update YNAB category" },
    },
    async ({ plan_id, category_id, name, note, category_group_id, goal_target, goal_target_date, goal_needs_whole_amount }) => {
      validateGoalFields(goal_needs_whole_amount, goal_target, goal_target_date);
      const category = compact({ name, note, category_group_id, goal_target, goal_target_date, goal_needs_whole_amount });
      if (Object.keys(category).length === 0) {
        throw new Error("At least one category field must be provided to update.");
      }
      return jsonResult(shapeCategory(await ynab.updateCategory(plan_id, category_id, category)));
    },
  );
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function validateGoalFields(
  goalNeedsWholeAmount: boolean | null | undefined,
  goalTarget: number | null | undefined,
  goalTargetDate: string | null | undefined,
): void {
  if (goalNeedsWholeAmount !== undefined && goalTarget === undefined && goalTargetDate === undefined) {
    throw new Error("goal_needs_whole_amount requires goal_target or goal_target_date.");
  }
}
