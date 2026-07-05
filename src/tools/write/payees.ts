import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YnabClient } from "../../ynab/client.js";
import { parseCreatePayeeCommand, parseUpdatePayeeCommand } from "../../domain/ynabCommands.js";
import { createAnnotations, updateAnnotations } from "../annotations.js";
import { ynabResult } from "../result.js";
import { planId, writePayeeId } from "../schemas.js";
import { shapePayee } from "../shaping.js";

const payeeNameValue = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("Payee name. Must be 1-100 non-blank characters.");

export function registerPayeeWriteTools(server: McpServer, ynab: YnabClient): void {
  server.registerTool(
    "ynab_create_payee",
    {
      title: "Create YNAB payee",
      description: "Create a payee in a YNAB plan for stable use in transaction tools.",
      inputSchema: { plan_id: planId, name: payeeNameValue },
      annotations: { ...createAnnotations, title: "Create YNAB payee" },
    },
    (args) => {
      const command = parseCreatePayeeCommand(args);
      return ynabResult(ynab.createPayee(command.planId, command.payee), shapePayee);
    },
  );

  server.registerTool(
    "ynab_update_payee",
    {
      title: "Update YNAB payee",
      description: "Rename an existing YNAB payee.",
      inputSchema: { plan_id: planId, payee_id: writePayeeId, name: payeeNameValue },
      annotations: { ...updateAnnotations, title: "Update YNAB payee" },
    },
    (args) => {
      const command = parseUpdatePayeeCommand(args);
      return ynabResult(
        ynab.updatePayee(command.planId, command.payeeId, command.payee),
        shapePayee,
      );
    },
  );
}
