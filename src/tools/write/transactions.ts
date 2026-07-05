import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import {
  parseCreateTransactionCommand,
  parseDeleteTransactionCommand,
  parseUpdateTransactionCommand,
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
  writeTransactionId,
} from "../schemas.js";
import { shapeTransactionWrite } from "../shaping.js";

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
const transactionCleared = z
  .enum(["cleared", "uncleared", "reconciled"])
  .optional()
  .describe("YNAB cleared status.");
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
  .describe(
    "Optional YNAB import_id for duplicate detection. Must be unique and at most 36 characters.",
  );
const transactionCreateFields = {
  account_id: accountId,
  date: isoDate,
  amount: milliunits.describe(
    "Transaction amount in YNAB milliunits. Outflows are negative; inflows are positive.",
  ),
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
  amount: milliunits
    .optional()
    .describe(
      "Transaction amount in YNAB milliunits. Outflows are negative; inflows are positive.",
    ),
  payee_id: payeeId,
  payee_name: payeeName,
  category_id: nullableTransactionCategoryId,
  memo: nullableMemo,
  cleared: transactionCleared,
  approved: z.boolean().optional().describe("Whether the transaction is approved."),
  flag_color: transactionFlagColor,
} as const;

export function registerTransactionWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_transaction",
    {
      title: "Create YNAB transaction",
      description:
        "Create a single non-split, non-transfer transaction in a YNAB plan. Use account, category, and payee IDs from the read tools when possible.",
      inputSchema: { plan_id: planId, ...transactionCreateFields },
      annotations: { ...createAnnotations, title: "Create YNAB transaction" },
    },
    (args) => {
      const command = parseCreateTransactionCommand(args);
      return ynabResult(
        ynab.createTransaction(command.planId, command.transaction),
        shapeTransactionWrite,
      );
    },
  );

  server.registerTool(
    "ynab_update_transaction",
    {
      title: "Update YNAB transaction",
      description:
        "Update fields on a single non-split, non-transfer YNAB transaction. Omit unchanged fields.",
      inputSchema: {
        plan_id: planId,
        transaction_id: writeTransactionId,
        ...transactionUpdateFields,
      },
      annotations: { ...updateAnnotations, title: "Update YNAB transaction" },
    },
    (args) => {
      const command = parseUpdateTransactionCommand(args);
      return ynabResult(
        ynab.updateTransaction(command.planId, command.transactionId, command.transaction),
        shapeTransactionWrite,
      );
    },
  );

  server.registerTool(
    "ynab_delete_transaction",
    {
      title: "Delete YNAB transaction",
      description:
        "Permanently delete a single YNAB transaction. This is destructive; inspect the transaction first when possible.",
      inputSchema: { plan_id: planId, transaction_id: writeTransactionId },
      annotations: { ...deleteAnnotations, title: "Delete YNAB transaction" },
    },
    (args) => {
      const command = parseDeleteTransactionCommand(args);
      return ynabResult(
        ynab.deleteTransaction(command.planId, command.transactionId),
        shapeTransactionWrite,
      );
    },
  );
}
