import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import {
  parseCreateScheduledTransactionCommand,
  parseDeleteScheduledTransactionCommand,
  parseUpdateScheduledTransactionCommand,
} from "../../domain/ynabCommands.js";
import { createAnnotations, deleteAnnotations, updateAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import {
  accountId,
  categoryId,
  isoDate,
  milliunits,
  planId,
  writePayeeId,
  writeScheduledTransactionId,
} from "../schemas.js";
import { shapeScheduledTransactionWrite } from "../shaping.js";

const nullableMemo = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .describe("Transaction memo. Pass null to clear an existing memo.");
const payeeId = writePayeeId
  .optional()
  .describe("Existing YNAB payee ID. Do not provide with payee_name.");
const payeeNameValue = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Payee name. Must be 1-100 non-blank characters.");
const payeeName = payeeNameValue.optional().describe("Payee name. Do not provide with payee_id.");
const nullableTransactionCategoryId = categoryId
  .nullable()
  .optional()
  .describe(
    "YNAB category ID. Omit or pass null only for uncategorized transactions or to clear a category; transfer creation is not supported.",
  );
const transactionFlagColor = z
  .enum(["red", "orange", "yellow", "green", "blue", "purple"])
  .nullable()
  .optional()
  .describe("YNAB flag color. Pass null to clear the flag.");
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
  amount: milliunits.describe(
    "Scheduled transaction amount in YNAB milliunits. Outflows are negative; inflows are positive.",
  ),
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
  amount: milliunits
    .optional()
    .describe(
      "Scheduled transaction amount in YNAB milliunits. Outflows are negative; inflows are positive.",
    ),
  frequency: scheduledTransactionFrequency.optional(),
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  flag_color: transactionFlagColor,
} as const;

export function registerScheduledTransactionWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_scheduled_transaction",
    {
      title: "Create YNAB scheduled transaction",
      description:
        "Create a scheduled non-split, non-transfer transaction in a YNAB plan. Use account, category, and payee IDs from read tools when possible.",
      inputSchema: { plan_id: planId, ...scheduledTransactionCreateFields },
      annotations: { ...createAnnotations, title: "Create YNAB scheduled transaction" },
    },
    (args) => {
      const command = parseCreateScheduledTransactionCommand(args);
      return ynabResult(
        ynab.createScheduledTransaction(command.planId, command.scheduledTransaction),
        shapeScheduledTransactionWrite,
      );
    },
  );

  server.registerTool(
    "ynab_update_scheduled_transaction",
    {
      title: "Update YNAB scheduled transaction",
      description:
        "Update fields on a scheduled non-split, non-transfer YNAB transaction. Omit unchanged fields.",
      inputSchema: {
        plan_id: planId,
        scheduled_transaction_id: writeScheduledTransactionId,
        ...scheduledTransactionUpdateFields,
      },
      annotations: { ...updateAnnotations, title: "Update YNAB scheduled transaction" },
    },
    (args) => {
      const command = parseUpdateScheduledTransactionCommand(args);
      return ynabResult(
        ynab.updateScheduledTransaction(
          command.planId,
          command.scheduledTransactionId,
          command.scheduledTransaction,
        ),
        shapeScheduledTransactionWrite,
      );
    },
  );

  server.registerTool(
    "ynab_delete_scheduled_transaction",
    {
      title: "Delete YNAB scheduled transaction",
      description:
        "Permanently delete a YNAB scheduled transaction. This is destructive; inspect it first when possible.",
      inputSchema: { plan_id: planId, scheduled_transaction_id: writeScheduledTransactionId },
      annotations: { ...deleteAnnotations, title: "Delete YNAB scheduled transaction" },
    },
    (args) => {
      const command = parseDeleteScheduledTransactionCommand(args);
      return ynabResult(
        ynab.deleteScheduledTransaction(command.planId, command.scheduledTransactionId),
        shapeScheduledTransactionWrite,
      );
    },
  );
}
