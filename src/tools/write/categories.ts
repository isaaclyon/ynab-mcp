import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import {
  parseCreateCategoryCommand,
  parseCreateCategoryGroupCommand,
  parseUpdateCategoryCommand,
  parseUpdateCategoryGroupCommand,
} from "../../domain/ynabCommands.js";
import { createAnnotations, updateAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { categoryGroupId, categoryId, isoDate, milliunits, planId } from "../schemas.js";
import { shapeCategory, shapeCategoryGroup } from "../shaping.js";

const categoryName = z
  .string()
  .min(1)
  .max(50)
  .describe("Category name. YNAB limits names to 50 characters.");
const groupName = z
  .string()
  .min(1)
  .max(50)
  .describe("Category group name. YNAB limits names to 50 characters.");
const nullableNote = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .describe("Category note. Pass null to clear an existing note.");
const nullableMilliunits = milliunits
  .nullable()
  .optional()
  .describe(
    "YNAB milliunits amount. For example, $12.34 is 12340. Pass null to remove an existing target.",
  );
const nullableIsoDate = isoDate
  .nullable()
  .optional()
  .describe(
    "ISO date in YYYY-MM-DD format. Pass null to clear when YNAB supports clearing this field.",
  );
const categoryUpdateFields = {
  name: categoryName.optional().describe("New category name."),
  note: nullableNote,
  category_group_id: categoryGroupId
    .optional()
    .describe("Move the category to this category group."),
  goal_target: nullableMilliunits,
  goal_target_date: nullableIsoDate,
  goal_needs_whole_amount: z
    .boolean()
    .nullable()
    .optional()
    .describe("For NEED goals, whether the full target amount is required each period."),
} as const;

export function registerCategoryWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_category_group",
    {
      title: "Create YNAB category group",
      description:
        "Create a new category group in a YNAB plan. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, name: groupName },
      annotations: { ...createAnnotations, title: "Create YNAB category group" },
    },
    (args) => {
      const command = parseCreateCategoryGroupCommand(args);
      return ynabResult(
        ynab.createCategoryGroup(command.planId, command.categoryGroup),
        shapeCategoryGroup,
      );
    },
  );

  server.registerTool(
    "ynab_update_category_group",
    {
      title: "Update YNAB category group",
      description:
        "Rename an existing YNAB category group. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, category_group_id: categoryGroupId, name: groupName },
      annotations: { ...updateAnnotations, title: "Update YNAB category group" },
    },
    (args) => {
      const command = parseUpdateCategoryGroupCommand(args);
      return ynabResult(
        ynab.updateCategoryGroup(command.planId, command.categoryGroupId, command.categoryGroup),
        shapeCategoryGroup,
      );
    },
  );

  server.registerTool(
    "ynab_create_category",
    {
      title: "Create YNAB category",
      description:
        "Create a new category in a category group. YNAB does not expose delete for categories.",
      inputSchema: {
        plan_id: planId,
        category_group_id: categoryGroupId,
        name: categoryName,
        note: nullableNote,
        goal_target: nullableMilliunits,
        goal_target_date: isoDate.optional(),
        goal_needs_whole_amount: z.boolean().nullable().optional(),
      },
      annotations: { ...createAnnotations, title: "Create YNAB category" },
    },
    (args) => {
      const command = parseCreateCategoryCommand(args);
      return ynabResult(ynab.createCategory(command.planId, command.category), shapeCategory);
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
    (args) => {
      const command = parseUpdateCategoryCommand(args);
      return ynabResult(
        ynab.updateCategory(command.planId, command.categoryId, command.category),
        shapeCategory,
      );
    },
  );
}
