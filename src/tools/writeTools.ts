import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../ynab/client.js";
import { createAnnotations, deleteAnnotations, updateAnnotations } from "./annotations.js";
import { ynabResult } from "./result.js";
import { shapeCategory, shapeCategoryGroup, shapeMonthCategory, shapePayee, shapeScheduledTransaction, shapeTransactionWrite } from "./shaping.js";

const planId = z.string().trim().min(1).describe("YNAB plan ID returned by ynab_list_plans.");
const month = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe("Month in YYYY-MM format.");
const categoryGroupId = z.string().trim().min(1).describe("YNAB category group ID returned by ynab_list_categories.");
const categoryId = z.string().trim().min(1).describe("YNAB category ID returned by ynab_list_categories.");
const accountId = z.string().trim().min(1).describe("YNAB account ID returned by ynab_list_accounts.");
const transactionId = z.string().trim().min(1).describe("YNAB transaction ID returned by ynab_search_transactions or transaction list tools.");
const scheduledTransactionId = z
  .string()
  .trim()
  .min(1)
  .describe("YNAB scheduled transaction ID returned by ynab_list_scheduled_transactions.");
const categoryName = z.string().min(1).max(50).describe("Category name. YNAB limits names to 50 characters.");
const groupName = z.string().min(1).max(50).describe("Category group name. YNAB limits names to 50 characters.");
const nullableNote = z.string().max(500).nullable().optional().describe("Category note. Pass null to clear an existing note.");
const nullableMemo = z.string().max(500).nullable().optional().describe("Transaction memo. Pass null to clear an existing memo.");
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
const payeeToolId = z.string().min(1).describe("YNAB payee ID returned by ynab_list_payees.");
const payeeId = payeeToolId.optional().describe("Existing YNAB payee ID. Do not provide with payee_name.");
const payeeNameValue = z.string().trim().min(1).max(100).describe("Payee name. Must be 1-100 non-blank characters.");
const payeeName = payeeNameValue.optional().describe("Payee name. Do not provide with payee_id.");
const nullableTransactionCategoryId = categoryId
  .nullable()
  .optional()
  .describe("YNAB category ID. Omit or pass null only for uncategorized transactions or to clear a category; transfer creation is not supported.");
const transactionCleared = z.enum(["cleared", "uncleared", "reconciled"]).optional().describe("YNAB cleared status.");
const transactionFlagColor = z
  .enum(["red", "orange", "yellow", "green", "blue", "purple"])
  .nullable()
  .optional()
  .describe("YNAB flag color. Pass null to clear the flag.");
const importId = z
  .string()
  .min(1)
  .max(36)
  .optional()
  .describe("Optional YNAB import_id for duplicate detection. Must be unique and at most 36 characters.");
const budgeted = z
  .number()
  .int()
  .describe("Assigned budget amount in YNAB milliunits for this category month. For example, $12.34 is 12340.");
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
const transactionCreateFields = {
  account_id: accountId,
  date: isoDate,
  amount: z.number().int().describe("Transaction amount in YNAB milliunits. Outflows are negative; inflows are positive."),
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  cleared: transactionCleared,
  approved: z.boolean().optional().describe("Whether the transaction is approved."),
  flag_color: transactionFlagColor,
  import_id: importId,
} as const;
const transactionUpdateFields = {
  account_id: accountId.optional(),
  date: isoDate.optional(),
  amount: z.number().int().optional().describe("Transaction amount in YNAB milliunits. Outflows are negative; inflows are positive."),
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  cleared: transactionCleared,
  approved: z.boolean().optional().describe("Whether the transaction is approved."),
  flag_color: transactionFlagColor,
} as const;
const scheduledTransactionFrequency = z
  .enum([
    "never",
    "daily",
    "weekly",
    "everyOtherWeek",
    "twiceAMonth",
    "every4Weeks",
    "monthly",
    "everyOtherMonth",
    "every3Months",
    "every4Months",
    "twiceAYear",
    "yearly",
    "everyOtherYear",
  ])
  .describe("YNAB scheduled transaction frequency.");
const scheduledTransactionCreateFields = {
  account_id: accountId,
  date: isoDate,
  amount: z.number().int().describe("Scheduled transaction amount in YNAB milliunits. Outflows are negative; inflows are positive."),
  frequency: scheduledTransactionFrequency,
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  flag_color: transactionFlagColor,
} as const;
const scheduledTransactionUpdateFields = {
  account_id: accountId.optional(),
  date: isoDate.optional(),
  amount: z.number().int().optional().describe("Scheduled transaction amount in YNAB milliunits. Outflows are negative; inflows are positive."),
  frequency: scheduledTransactionFrequency.optional(),
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  flag_color: transactionFlagColor,
} as const;

export function registerWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_payee",
    {
      title: "Create YNAB payee",
      description: "Create a payee in a YNAB plan for stable use in transaction tools.",
      inputSchema: { plan_id: planId, name: payeeNameValue },
      annotations: { ...createAnnotations, title: "Create YNAB payee" },
    },
    ({ plan_id, name }) => ynabResult(ynab.createPayee(plan_id, { name }), shapePayee),
  );

  server.registerTool(
    "ynab_update_payee",
    {
      title: "Update YNAB payee",
      description: "Rename an existing YNAB payee.",
      inputSchema: { plan_id: planId, payee_id: payeeToolId, name: payeeNameValue },
      annotations: { ...updateAnnotations, title: "Update YNAB payee" },
    },
    ({ plan_id, payee_id, name }) => ynabResult(ynab.updatePayee(plan_id, payee_id, { name }), shapePayee),
  );

  server.registerTool(
    "ynab_create_category_group",
    {
      title: "Create YNAB category group",
      description: "Create a new category group in a YNAB plan. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, name: groupName },
      annotations: { ...createAnnotations, title: "Create YNAB category group" },
    },
    ({ plan_id, name }) => ynabResult(ynab.createCategoryGroup(plan_id, { name }), shapeCategoryGroup),
  );

  server.registerTool(
    "ynab_update_category_group",
    {
      title: "Update YNAB category group",
      description: "Rename an existing YNAB category group. YNAB does not expose delete for category groups.",
      inputSchema: { plan_id: planId, category_group_id: categoryGroupId, name: groupName },
      annotations: { ...updateAnnotations, title: "Update YNAB category group" },
    },
    ({ plan_id, category_group_id, name }) =>
      ynabResult(ynab.updateCategoryGroup(plan_id, category_group_id, { name }), shapeCategoryGroup),
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
      return ynabResult(
        ynab.createCategory(
          plan_id,
          {
            category_group_id,
            name,
            ...compact({ note, goal_target, goal_target_date, goal_needs_whole_amount }),
          },
        ),
        shapeCategory,
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
      return ynabResult(ynab.updateCategory(plan_id, category_id, category), shapeCategory);
    },
  );

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

  server.registerTool(
    "ynab_create_transaction",
    {
      title: "Create YNAB transaction",
      description:
        "Create a single non-split, non-transfer transaction in a YNAB plan. Use account, category, and payee IDs from the read tools when possible.",
      inputSchema: { plan_id: planId, ...transactionCreateFields },
      annotations: { ...createAnnotations, title: "Create YNAB transaction" },
    },
    async ({ plan_id, account_id, date, amount, payee_id, payee_name, category_id, memo, cleared, approved, flag_color, import_id }) => {
      validatePayeeFields(payee_id, payee_name);
      return ynabResult(
        ynab.createTransaction(
          plan_id,
          {
            account_id,
            date,
            amount,
            ...compact({ payee_id, payee_name, category_id, memo, cleared, approved, flag_color, import_id }),
          },
        ),
        shapeTransactionWrite,
      );
    },
  );

  server.registerTool(
    "ynab_update_transaction",
    {
      title: "Update YNAB transaction",
      description: "Update fields on a single non-split, non-transfer YNAB transaction. Omit unchanged fields.",
      inputSchema: { plan_id: planId, transaction_id: transactionId, ...transactionUpdateFields },
      annotations: { ...updateAnnotations, title: "Update YNAB transaction" },
    },
    async ({ plan_id, transaction_id, account_id, date, amount, payee_id, payee_name, category_id, memo, cleared, approved, flag_color }) => {
      validatePayeeFields(payee_id, payee_name);
      const transaction = compact({ account_id, date, amount, payee_id, payee_name, category_id, memo, cleared, approved, flag_color });
      if (Object.keys(transaction).length === 0) {
        throw new Error("At least one transaction field must be provided to update.");
      }
      return ynabResult(ynab.updateTransaction(plan_id, transaction_id, transaction), shapeTransactionWrite);
    },
  );

  server.registerTool(
    "ynab_delete_transaction",
    {
      title: "Delete YNAB transaction",
      description: "Permanently delete a single YNAB transaction. This is destructive; inspect the transaction first when possible.",
      inputSchema: { plan_id: planId, transaction_id: transactionId },
      annotations: { ...deleteAnnotations, title: "Delete YNAB transaction" },
    },
    ({ plan_id, transaction_id }) =>
      ynabResult(ynab.deleteTransaction(plan_id, transaction_id), shapeTransactionWrite),
  );

  server.registerTool(
    "ynab_create_scheduled_transaction",
    {
      title: "Create YNAB scheduled transaction",
      description:
        "Create a scheduled non-split, non-transfer transaction in a YNAB plan. Use account, category, and payee IDs from read tools when possible.",
      inputSchema: { plan_id: planId, ...scheduledTransactionCreateFields },
      annotations: { ...createAnnotations, title: "Create YNAB scheduled transaction" },
    },
    async ({ plan_id, account_id, date, amount, frequency, payee_id, payee_name, category_id, memo, flag_color }) => {
      validatePayeeFields(payee_id, payee_name);
      return ynabResult(
        ynab.createScheduledTransaction(
          plan_id,
          { account_id, date, amount, frequency, ...compact({ payee_id, payee_name, category_id, memo, flag_color }) },
        ),
        shapeScheduledTransaction,
      );
    },
  );

  server.registerTool(
    "ynab_update_scheduled_transaction",
    {
      title: "Update YNAB scheduled transaction",
      description: "Update fields on a scheduled non-split, non-transfer YNAB transaction. Omit unchanged fields.",
      inputSchema: { plan_id: planId, scheduled_transaction_id: scheduledTransactionId, ...scheduledTransactionUpdateFields },
      annotations: { ...updateAnnotations, title: "Update YNAB scheduled transaction" },
    },
    async ({ plan_id, scheduled_transaction_id, account_id, date, amount, frequency, payee_id, payee_name, category_id, memo, flag_color }) => {
      validatePayeeFields(payee_id, payee_name);
      const scheduledTransaction = compact({ account_id, date, amount, frequency, payee_id, payee_name, category_id, memo, flag_color });
      if (Object.keys(scheduledTransaction).length === 0) {
        throw new Error("At least one scheduled transaction field must be provided to update.");
      }
      return ynabResult(
        ynab.updateScheduledTransaction(plan_id, scheduled_transaction_id, scheduledTransaction),
        shapeScheduledTransaction,
      );
    },
  );

  server.registerTool(
    "ynab_delete_scheduled_transaction",
    {
      title: "Delete YNAB scheduled transaction",
      description: "Permanently delete a YNAB scheduled transaction. This is destructive; inspect it first when possible.",
      inputSchema: { plan_id: planId, scheduled_transaction_id: scheduledTransactionId },
      annotations: { ...deleteAnnotations, title: "Delete YNAB scheduled transaction" },
    },
    ({ plan_id, scheduled_transaction_id }) =>
      ynabResult(ynab.deleteScheduledTransaction(plan_id, scheduled_transaction_id), shapeScheduledTransaction),
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

function validatePayeeFields(payeeIdValue: string | undefined, payeeNameValue: string | undefined): void {
  if (payeeIdValue && payeeNameValue) {
    throw new Error("Provide either payee_id or payee_name, not both.");
  }
}
