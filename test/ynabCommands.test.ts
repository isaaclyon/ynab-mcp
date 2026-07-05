import { describe, expect, it } from "vitest";
import {
  parseCreateTransactionCommand,
  parseUpdateCategoryCommand,
  parseUpdateTransactionCommand,
} from "../src/domain/ynabCommands.js";
import { isoDateSchema, monthSchema, toYnabMonthDate } from "../src/domain/ynabValues.js";

describe("YNAB parsed values", () => {
  it("parses user-facing months and converts them to YNAB month dates", () => {
    const month = monthSchema.parse(" 2026-07 ");

    expect(toYnabMonthDate(month)).toBe("2026-07-01");
    expect(() => monthSchema.parse("2026-13")).toThrow();
  });

  it("rejects non-ISO date strings", () => {
    expect(isoDateSchema.parse("2026-07-03")).toBe("2026-07-03");
    expect(() => isoDateSchema.parse("2026-7-3")).toThrow();
  });
});

describe("YNAB write command parsers", () => {
  it("constructs transaction commands only when payee fields are not ambiguous", () => {
    expect(() =>
      parseCreateTransactionCommand({
        plan_id: "plan-1",
        account_id: "account-1",
        date: "2026-07-03",
        amount: -12340,
        payee_id: "payee-1",
        payee_name: "Coffee Shop",
      }),
    ).toThrow("Provide either payee_id or payee_name, not both.");

    expect(parseCreateTransactionCommand({
      plan_id: "plan-1",
      account_id: "account-1",
      date: "2026-07-03",
      amount: -12340,
      payee_name: " Coffee Shop ",
    }).transaction).toEqual({
      account_id: "account-1",
      date: "2026-07-03",
      amount: -12340,
      payee_name: "Coffee Shop",
    });
  });

  it("rejects empty transaction update commands", () => {
    expect(() => parseUpdateTransactionCommand({ plan_id: "plan-1", transaction_id: "txn-1" })).toThrow(
      "At least one transaction field must be provided to update.",
    );
  });

  it("keeps category goal invariants in the category command parser", () => {
    expect(() =>
      parseUpdateCategoryCommand({ plan_id: "plan-1", category_id: "cat-1", goal_needs_whole_amount: true }),
    ).toThrow("goal_needs_whole_amount requires goal_target or goal_target_date.");

    expect(parseUpdateCategoryCommand({ plan_id: "plan-1", category_id: "cat-1", goal_target: null }).category).toEqual({
      goal_target: null,
    });
  });
});
