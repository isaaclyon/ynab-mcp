import { describe, expect, it } from "vitest";
import { shapeAccounts, shapeCategories, shapeMonth, shapePlans, shapeScheduledTransactions, shapeTransactions } from "../src/tools/shaping.js";
import { YnabResponseShapeError } from "../src/tools/ynabResponseSchemas.js";

describe("YNAB response shaping", () => {
  it("preserves compact valid plan output while ignoring extra upstream fields", () => {
    expect(
      shapePlans({
        data: {
          plans: [
            {
              id: "plan-1",
              name: "Personal",
              last_modified_on: "2026-07-04T00:00:00Z",
              currency_format: { iso_code: "USD" },
              extra: "ignored",
            },
          ],
        },
      }),
    ).toEqual({
      plans: [
        {
          id: "plan-1",
          name: "Personal",
          last_modified_on: "2026-07-04T00:00:00Z",
          currency_format: { iso_code: "USD" },
        },
      ],
    });
  });

  it("filters closed accounts after validating the account response slice", () => {
    expect(
      shapeAccounts(
        {
          data: {
            accounts: [
              { id: "checking", name: "Checking", type: "checking", on_budget: true, closed: false, balance: 1000, cleared_balance: 900, uncleared_balance: 100, deleted: false, ignored: true },
              { id: "closed", name: "Closed", closed: true, balance: "not-a-number" },
            ],
          },
        },
        false,
      ),
    ).toEqual({ accounts: [{ id: "checking", name: "Checking", type: "checking", on_budget: true, closed: false, balance: 1000, cleared_balance: 900, uncleared_balance: 100, deleted: false }] });
  });

  it("preserves category group and category shaping", () => {
    expect(
      shapeCategories({
        data: {
          category_groups: [
            {
              id: "group-1",
              name: "Monthly Bills",
              hidden: false,
              deleted: false,
              categories: [
                {
                  id: "cat-1",
                  category_group_id: "group-1",
                  name: "Rent",
                  note: null,
                  budgeted: 1000000,
                  activity: -1000000,
                  balance: 0,
                  deleted: false,
                  ignored: "ignored",
                },
              ],
            },
          ],
        },
      }),
    ).toEqual({
      category_groups: [
        {
          id: "group-1",
          name: "Monthly Bills",
          hidden: false,
          deleted: false,
          categories: [
            {
              id: "cat-1",
              category_group_id: "group-1",
              name: "Rent",
              note: null,
              budgeted: 1000000,
              activity: -1000000,
              balance: 0,
              deleted: false,
            },
          ],
        },
      ],
    });
  });

  it("preserves month category shaping", () => {
    expect(
      shapeMonth({
        data: {
          month: {
            month: "2026-07",
            note: null,
            income: 5000000,
            budgeted: 1000000,
            activity: -250000,
            to_be_budgeted: 0,
            age_of_money: 42,
            deleted: false,
            categories: [{ id: "cat-1", category_group_id: "group-1", name: "Coffee", budgeted: 10000, activity: -5000, balance: 5000, deleted: false }],
          },
        },
      }),
    ).toEqual({
      month: {
        month: "2026-07",
        note: null,
        income: 5000000,
        budgeted: 1000000,
        activity: -250000,
        to_be_budgeted: 0,
        age_of_money: 42,
        deleted: false,
        categories: [{ id: "cat-1", category_group_id: "group-1", name: "Coffee", budgeted: 10000, activity: -5000, balance: 5000, deleted: false }],
      },
    });
  });

  it("preserves transaction filtering, limiting, and subtransaction shaping", () => {
    expect(
      shapeTransactions(
        {
          data: {
            transactions: [
              {
                id: "txn-1",
                date: "2026-07-04",
                amount: -12340,
                memo: "Beans",
                account_id: "account-1",
                account_name: "Checking",
                payee_name: "Coffee Shop",
                category_id: "cat-1",
                category_name: "Coffee",
                deleted: false,
                ignored: true,
                subtransactions: [
                  {
                    id: "sub-1",
                    transaction_id: "txn-1",
                    amount: -12340,
                    memo: null,
                    category_id: "cat-1",
                    ignored: true,
                  },
                ],
              },
              { id: "txn-2", amount: "not-a-number", account_id: "account-2", account_name: "Savings" },
            ],
          },
        },
        { limit: 1, query: "beans" },
      ),
    ).toEqual({
      transactions: [
        {
          id: "txn-1",
          date: "2026-07-04",
          amount: -12340,
          memo: "Beans",
          account_id: "account-1",
          account_name: "Checking",
          payee_name: "Coffee Shop",
          category_id: "cat-1",
          category_name: "Coffee",
          deleted: false,
          subtransactions: [{ id: "sub-1", transaction_id: "txn-1", amount: -12340, memo: null, category_id: "cat-1" }],
        },
      ],
    });
  });

  it("preserves scheduled transaction limiting", () => {
    expect(
      shapeScheduledTransactions(
        {
          data: {
            scheduled_transactions: [
              { id: "sched-1", date_next: "2026-08-01", amount: -1000, frequency: "monthly", account_id: "account-1", account_name: "Checking", deleted: false, ignored: true },
              { id: "sched-2", amount: -2000, frequency: "weekly" },
            ],
          },
        },
        1,
      ),
    ).toEqual({ scheduled_transactions: [{ id: "sched-1", date_next: "2026-08-01", amount: -1000, frequency: "monthly", account_id: "account-1", account_name: "Checking", deleted: false }] });
  });

  it("does not validate filtered-out or sliced-off list records", () => {
    expect(
      shapeAccounts(
        {
          data: {
            accounts: [
              { id: "open", name: "Open", type: "checking", on_budget: true, closed: false, balance: 1, cleared_balance: 1, uncleared_balance: 0, deleted: false },
              { id: "closed", closed: true, balance: "not-a-number" },
            ],
          },
        },
        false,
      ),
    ).toEqual({ accounts: [{ id: "open", name: "Open", type: "checking", on_budget: true, closed: false, balance: 1, cleared_balance: 1, uncleared_balance: 0, deleted: false }] });

    expect(
      shapeTransactions(
        {
          data: {
            transactions: [
              { id: "txn-1", date: "2026-07-04", amount: -1, account_id: "account-1", account_name: "Checking", deleted: false },
              { id: "txn-2", amount: "not-a-number", account_id: "account-2", account_name: "Savings" },
            ],
          },
        },
        { limit: 1 },
      ),
    ).toEqual({ transactions: [{ id: "txn-1", date: "2026-07-04", amount: -1, account_id: "account-1", account_name: "Checking", deleted: false }] });
  });

  it("rejects primitive or null list items that would be emitted", () => {
    expect(() => shapeAccounts({ data: { accounts: [null] } }, false)).toThrow(YnabResponseShapeError);
    expect(() => shapeTransactions({ data: { transactions: ["oops"] } }, { limit: 1 })).toThrow(YnabResponseShapeError);
    expect(() => shapeScheduledTransactions({ data: { scheduled_transactions: [123] } }, 1)).toThrow(YnabResponseShapeError);
  });

  it("does not validate primitive transaction records excluded by filters or limits", () => {
    expect(shapeTransactions({ data: { transactions: ["oops"] } }, { limit: 1, accountId: "account-1" })).toEqual({ transactions: [] });
    expect(
      shapeScheduledTransactions(
        {
          data: {
            scheduled_transactions: [
              { id: "sched-1", date_next: "2026-08-01", amount: -1000, frequency: "monthly", account_id: "account-1", account_name: "Checking", deleted: false },
              null,
            ],
          },
        },
        1,
      ),
    ).toEqual({ scheduled_transactions: [{ id: "sched-1", date_next: "2026-08-01", amount: -1000, frequency: "monthly", account_id: "account-1", account_name: "Checking", deleted: false }] });
  });

  it("rejects missing response containers instead of silently returning empty output", () => {
    expect(() => shapePlans({ data: {} })).toThrow(YnabResponseShapeError);
    expect(() => shapePlans({ data: {} })).toThrow("data.plans");
  });

  it("rejects invalid emitted key field types without exposing raw response data", () => {
    const secretResponse = {
      data: {
        transactions: [
          { id: "txn-1", date: "2026-07-04", amount: "not-a-number", account_id: "account-1", account_name: "Checking", deleted: false, memo: "Authorization: Bearer secret-token" },
        ],
      },
    };

    expect(() => shapeTransactions(secretResponse, { limit: 10 })).toThrow(YnabResponseShapeError);
    expect(() => shapeTransactions(secretResponse, { limit: 10 })).toThrow("0.amount");
    expect(() => shapeTransactions(secretResponse, { limit: 10 })).not.toThrow("secret-token");
  });
});
