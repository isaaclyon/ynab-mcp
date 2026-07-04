import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createApp } from "../src/http/app.js";
import { testConfig } from "./testConfig.js";

let closeServer: (() => Promise<void>) | undefined;

afterEach(async () => {
  if (closeServer) {
    await closeServer();
    closeServer = undefined;
  }
});

describe("MCP smoke", () => {
  it("initializes, lists tools, and calls a read-only YNAB tool through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { plans: [{ id: "plan-1", name: "Personal" }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_plans");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_months");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_get_month_category");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_update_month_category");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_category");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_update_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_delete_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_account_transactions");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_category_transactions");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_payee_transactions");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_month_transactions");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_scheduled_transactions");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_get_scheduled_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_list_payees");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_get_payee");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_payee");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_update_payee");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_scheduled_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_update_scheduled_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_delete_scheduled_transaction");
    expect(tools.tools.find((tool) => tool.name === "ynab_list_plans")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_get_month_category")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_update_month_category")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_create_category")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_update_category")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_create_transaction")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_list_category_transactions")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_list_account_transactions")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_delete_transaction")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_list_scheduled_transactions")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_get_scheduled_transaction")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_create_scheduled_transaction")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_update_scheduled_transaction")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_delete_scheduled_transaction")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_list_payees")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    expect(tools.tools.find((tool) => tool.name === "ynab_create_payee")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });

    const result = await client.callTool({ name: "ynab_list_plans", arguments: {} }, CallToolResultSchema);
    const text = firstText(result);
    expect(JSON.parse(text) as unknown).toEqual({
      plans: [{ id: "plan-1", name: "Personal" }],
    });

    await client.close();
  });

  it("deduplicates concurrent stateless tool reads without reusing a connected MCP server", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response(JSON.stringify({ data: { plans: [{ id: "plan-1", name: "Personal" }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "concurrent-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const [first, second] = await Promise.all([
      client.callTool({ name: "ynab_list_plans", arguments: {} }, CallToolResultSchema),
      client.callTool({ name: "ynab_list_plans", arguments: {} }, CallToolResultSchema),
    ]);

    expect(firstText(first)).toContain("plan-1");
    expect(firstText(second)).toContain("plan-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await client.close();
  });

  it("calls a category write tool through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            category: {
              id: "cat-1",
              category_group_id: "group-1",
              name: "Coffee",
              note: null,
              budgeted: 0,
              activity: 0,
              balance: 0,
              deleted: false,
            },
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "write-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool(
      { name: "ynab_create_category", arguments: { plan_id: "plan-1", category_group_id: "group-1", name: "Coffee" } },
      CallToolResultSchema,
    );

    expect(JSON.parse(firstText(result)) as unknown).toMatchObject({
      category: { id: "cat-1", category_group_id: "group-1", name: "Coffee" },
    });
    const [apiUrl, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(apiUrl)).toBe("https://api.ynab.test/v1/plans/plan-1/categories");
    expect(init?.method).toBe("POST");

    await client.close();
  });

  it("calls transaction write tools through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/v1/plans/plan-1/transactions" && init?.method === "POST") {
        return jsonResponse({
          data: {
            transaction: {
              id: "txn-1",
              date: "2026-07-03",
              amount: -12340,
              account_id: "account-1",
              account_name: "Checking",
              payee_name: "Coffee Shop",
              category_id: "cat-1",
              category_name: "Coffee",
              memo: "Beans",
              cleared: "cleared",
              approved: true,
              deleted: false,
            },
          },
        }, 201);
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/transactions/txn-1" && init?.method === "PUT") {
        return jsonResponse({
          data: {
            transaction: {
              id: "txn-1",
              date: "2026-07-03",
              amount: -12340,
              account_id: "account-1",
              memo: null,
              approved: false,
              deleted: false,
            },
          },
        });
      }
      return jsonResponse({ error: { detail: `Unhandled ${init?.method} ${requestUrl.pathname}` } }, 404);
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "transaction-write-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const createResult = await client.callTool(
      {
        name: "ynab_create_transaction",
        arguments: {
          plan_id: "plan-1",
          account_id: "account-1",
          date: "2026-07-03",
          amount: -12340,
          payee_name: "Coffee Shop",
          category_id: "cat-1",
          memo: "Beans",
          cleared: "cleared",
          approved: true,
        },
      },
      CallToolResultSchema,
    );
    expect(JSON.parse(firstText(createResult)) as unknown).toMatchObject({
      transaction: { id: "txn-1", account_id: "account-1", payee_name: "Coffee Shop", category_id: "cat-1" },
    });

    const updateResult = await client.callTool(
      { name: "ynab_update_transaction", arguments: { plan_id: "plan-1", transaction_id: "txn-1", memo: null, approved: false } },
      CallToolResultSchema,
    );
    expect(JSON.parse(firstText(updateResult)) as unknown).toMatchObject({
      transaction: { id: "txn-1", memo: null, approved: false },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      transaction: { account_id: "account-1", date: "2026-07-03", amount: -12340, payee_name: "Coffee Shop" },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({ transaction: { memo: null, approved: false } });

    await client.close();
  });

  it("calls scoped transaction read tools and destructive delete through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/v1/plans/plan-1/categories/cat-1/transactions" && init?.method === "GET") {
        return jsonResponse({
          data: {
            transactions: [
              {
                id: "txn-cat-1",
                date: "2026-07-03",
                amount: -12340,
                account_id: "account-1",
                account_name: "Checking",
                payee_id: "payee-1",
                payee_name: "Coffee Shop",
                category_id: "cat-1",
                category_name: "Coffee",
                memo: "Beans",
                deleted: false,
              },
            ],
          },
        });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/accounts/account-1/transactions" && init?.method === "GET") {
        return jsonResponse({
          data: {
            transactions: [
              { id: "txn-account-1", account_id: "account-1", account_name: "Checking", amount: -1000, ignored_extra: true },
              { id: "txn-account-2", account_id: "account-1", account_name: "Checking", amount: -2000 },
            ],
          },
        });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/payees/payee-1/transactions" && init?.method === "GET") {
        return jsonResponse({ data: { transactions: [{ id: "txn-payee-1", payee_id: "payee-1", payee_name: "Coffee Shop" }] } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/months/2026-07-01/transactions" && init?.method === "GET") {
        return jsonResponse({ data: { transactions: [{ id: "txn-month-1", date: "2026-07-03", amount: -5000 }] } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/transactions/txn-cat-1" && init?.method === "DELETE") {
        return jsonResponse({ data: { transaction: { id: "txn-cat-1", deleted: true } } });
      }
      return jsonResponse({ error: { detail: `Unhandled ${init?.method} ${requestUrl.pathname}` } }, 404);
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "scoped-transaction-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_category_transactions", arguments: { plan_id: "plan-1", category_id: "cat-1" } }, CallToolResultSchema))) as unknown).toMatchObject({
      transactions: [{ id: "txn-cat-1", category_id: "cat-1", payee_name: "Coffee Shop" }],
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_account_transactions", arguments: { plan_id: "plan-1", account_id: "account-1", limit: 1 } }, CallToolResultSchema))) as unknown).toEqual({
      transactions: [{ id: "txn-account-1", amount: -1000, account_id: "account-1", account_name: "Checking" }],
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_payee_transactions", arguments: { plan_id: "plan-1", payee_id: "payee-1" } }, CallToolResultSchema))) as unknown).toMatchObject({
      transactions: [{ id: "txn-payee-1", payee_id: "payee-1" }],
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_month_transactions", arguments: { plan_id: "plan-1", month: "2026-07" } }, CallToolResultSchema))) as unknown).toMatchObject({
      transactions: [{ id: "txn-month-1", date: "2026-07-03" }],
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_delete_transaction", arguments: { plan_id: "plan-1", transaction_id: "txn-cat-1" } }, CallToolResultSchema))) as unknown).toEqual({
      transaction: { id: "txn-cat-1", deleted: true },
    });
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "GET", "GET", "GET", "DELETE"]);

    await client.close();
  });

  it("calls scheduled transaction tools and destructive delete through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/v1/plans/plan-1/scheduled_transactions" && init?.method === "GET") {
        return jsonResponse({
          data: {
            scheduled_transactions: [
              {
                id: "sched-1",
                date_first: "2026-07-15",
                date_next: "2026-08-15",
                amount: -12340,
                frequency: "monthly",
                account_id: "account-1",
                account_name: "Checking",
                payee_name: "Coffee Shop",
                category_id: "cat-1",
                category_name: "Coffee",
                ignored_extra: true,
              },
              { id: "sched-2", amount: -2000, frequency: "weekly" },
            ],
          },
        });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/scheduled_transactions" && init?.method === "POST") {
        return jsonResponse({ data: { scheduled_transaction: { id: "sched-3", frequency: "monthly", payee_name: "Coffee Shop" } } }, 201);
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/scheduled_transactions/sched-1" && init?.method === "GET") {
        return jsonResponse({ data: { scheduled_transaction: { id: "sched-1", amount: -12340, frequency: "monthly", memo: "Beans" } } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/scheduled_transactions/sched-1" && init?.method === "PUT") {
        return jsonResponse({ data: { scheduled_transaction: { id: "sched-1", frequency: "weekly", memo: null } } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/scheduled_transactions/sched-1" && init?.method === "DELETE") {
        return jsonResponse({ data: { scheduled_transaction: { id: "sched-1", deleted: true } } });
      }
      return jsonResponse({ error: { detail: `Unhandled ${init?.method} ${requestUrl.pathname}` } }, 404);
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "scheduled-transaction-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_scheduled_transactions", arguments: { plan_id: "plan-1", limit: 1 } }, CallToolResultSchema))) as unknown).toEqual({
      scheduled_transactions: [
        {
          id: "sched-1",
          date_first: "2026-07-15",
          date_next: "2026-08-15",
          amount: -12340,
          frequency: "monthly",
          account_id: "account-1",
          account_name: "Checking",
          payee_name: "Coffee Shop",
          category_id: "cat-1",
          category_name: "Coffee",
        },
      ],
    });
    expect(JSON.parse(firstText(await client.callTool(
      {
        name: "ynab_create_scheduled_transaction",
        arguments: {
          plan_id: "plan-1",
          account_id: "account-1",
          date: "2026-07-15",
          amount: -12340,
          frequency: "monthly",
          payee_name: "Coffee Shop",
          category_id: "cat-1",
          memo: "Beans",
        },
      },
      CallToolResultSchema,
    ))) as unknown).toMatchObject({ scheduled_transaction: { id: "sched-3", frequency: "monthly" } });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_get_scheduled_transaction", arguments: { plan_id: "plan-1", scheduled_transaction_id: "sched-1" } }, CallToolResultSchema))) as unknown).toMatchObject({
      scheduled_transaction: { id: "sched-1", memo: "Beans" },
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_update_scheduled_transaction", arguments: { plan_id: "plan-1", scheduled_transaction_id: "sched-1", memo: null, frequency: "weekly" } }, CallToolResultSchema))) as unknown).toMatchObject({
      scheduled_transaction: { id: "sched-1", memo: null, frequency: "weekly" },
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_delete_scheduled_transaction", arguments: { plan_id: "plan-1", scheduled_transaction_id: "sched-1" } }, CallToolResultSchema))) as unknown).toEqual({
      scheduled_transaction: { id: "sched-1", deleted: true },
    });
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST", "GET", "PUT", "DELETE"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toMatchObject({
      scheduled_transaction: { account_id: "account-1", date: "2026-07-15", amount: -12340, frequency: "monthly", payee_name: "Coffee Shop" },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({ scheduled_transaction: { frequency: "weekly", memo: null } });

    await client.close();
  });

  it("calls month/category budgeting tools through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/v1/plans/plan-1/months" && init?.method === "GET") {
        return jsonResponse({
          data: {
            months: [
              {
                month: "2026-07",
                note: null,
                income: 5000000,
                budgeted: 1000000,
                activity: -250000,
                to_be_budgeted: 0,
                age_of_money: 42,
                deleted: false,
              },
            ],
          },
        });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/months/2026-07-01/categories/cat-1" && init?.method === "GET") {
        return jsonResponse({
          data: {
            category: {
              id: "cat-1",
              category_group_id: "group-1",
              name: "Coffee",
              budgeted: 10000,
              activity: -5000,
              balance: 5000,
              deleted: false,
            },
          },
        });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/months/2026-07-01/categories/cat-1" && init?.method === "PATCH") {
        return jsonResponse({
          data: {
            category: {
              id: "cat-1",
              category_group_id: "group-1",
              name: "Coffee",
              budgeted: 25000,
              activity: -5000,
              balance: 20000,
              deleted: false,
            },
          },
        });
      }
      return jsonResponse({ error: { detail: `Unhandled ${init?.method} ${requestUrl.pathname}` } }, 404);
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "month-category-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const monthsResult = await client.callTool({ name: "ynab_list_months", arguments: { plan_id: "plan-1" } }, CallToolResultSchema);
    expect(JSON.parse(firstText(monthsResult)) as unknown).toMatchObject({
      months: [{ month: "2026-07", budgeted: 1000000, activity: -250000 }],
    });

    const categoryResult = await client.callTool(
      { name: "ynab_get_month_category", arguments: { plan_id: "plan-1", month: "2026-07", category_id: "cat-1" } },
      CallToolResultSchema,
    );
    expect(JSON.parse(firstText(categoryResult)) as unknown).toMatchObject({
      category: { id: "cat-1", category_group_id: "group-1", name: "Coffee", budgeted: 10000 },
    });

    const updateResult = await client.callTool(
      { name: "ynab_update_month_category", arguments: { plan_id: "plan-1", month: "2026-07", category_id: "cat-1", budgeted: 25000 } },
      CallToolResultSchema,
    );
    expect(JSON.parse(firstText(updateResult)) as unknown).toMatchObject({
      category: { id: "cat-1", category_group_id: "group-1", budgeted: 25000 },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({ category: { budgeted: 25000 } });

    await client.close();
  });

  it("calls payee tools through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname === "/v1/plans/plan-1/payees" && init?.method === "GET") {
        return jsonResponse({ data: { payees: [{ id: "payee-1", name: "Coffee Shop", transfer_account_id: null, deleted: false }] } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/payees" && init?.method === "POST") {
        return jsonResponse({ data: { payee: { id: "payee-2", name: "Book Store", transfer_account_id: null, deleted: false } } }, 201);
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/payees/payee-1" && init?.method === "GET") {
        return jsonResponse({ data: { payee: { id: "payee-1", name: "Coffee Shop", transfer_account_id: null, deleted: false } } });
      }
      if (requestUrl.pathname === "/v1/plans/plan-1/payees/payee-1" && init?.method === "PATCH") {
        return jsonResponse({ data: { payee: { id: "payee-1", name: "Coffee Roaster", transfer_account_id: null, deleted: false } } });
      }
      return jsonResponse({ error: { detail: `Unhandled ${init?.method} ${requestUrl.pathname}` } }, 404);
    });
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "payee-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_list_payees", arguments: { plan_id: "plan-1" } }, CallToolResultSchema))) as unknown).toMatchObject({
      payees: [{ id: "payee-1", name: "Coffee Shop" }],
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_create_payee", arguments: { plan_id: "plan-1", name: "  Book Store  " } }, CallToolResultSchema))) as unknown).toMatchObject({
      payee: { id: "payee-2", name: "Book Store" },
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_get_payee", arguments: { plan_id: "plan-1", payee_id: "payee-1" } }, CallToolResultSchema))) as unknown).toMatchObject({
      payee: { id: "payee-1", name: "Coffee Shop" },
    });
    expect(JSON.parse(firstText(await client.callTool({ name: "ynab_update_payee", arguments: { plan_id: "plan-1", payee_id: "payee-1", name: "  Coffee Roaster  " } }, CallToolResultSchema))) as unknown).toMatchObject({
      payee: { id: "payee-1", name: "Coffee Roaster" },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({ payee: { name: "Book Store" } });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({ payee: { name: "Coffee Roaster" } });

    await client.close();
  });

  it("calls ynab_get_category as a read tool through Streamable HTTP", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            category: {
              id: "cat-1",
              category_group_id: "group-1",
              name: "Coffee",
              note: "Beans",
              budgeted: 0,
              activity: 0,
              balance: 0,
              deleted: false,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "get-category-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool(
      { name: "ynab_get_category", arguments: { plan_id: "plan-1", category_id: "cat-1" } },
      CallToolResultSchema,
    );

    expect(JSON.parse(firstText(result)) as unknown).toMatchObject({
      category: { id: "cat-1", category_group_id: "group-1", name: "Coffee", note: "Beans" },
    });
    const [apiUrl, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(apiUrl)).toBe("https://api.ynab.test/v1/plans/plan-1/categories/cat-1");
    expect(init?.method).toBe("GET");

    await client.close();
  });

  it("rejects empty category updates before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "empty-update-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool(
      { name: "ynab_update_category", arguments: { plan_id: "plan-1", category_id: "cat-1" } },
      CallToolResultSchema,
    );

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("At least one category field");
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });

  it("rejects invalid transaction updates before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "invalid-transaction-update-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const emptyResult = await client.callTool(
      { name: "ynab_update_transaction", arguments: { plan_id: "plan-1", transaction_id: "txn-1" } },
      CallToolResultSchema,
    );
    expect(emptyResult.isError).toBe(true);
    expect(firstText(emptyResult)).toContain("At least one transaction field");

    const payeeResult = await client.callTool(
      {
        name: "ynab_update_transaction",
        arguments: { plan_id: "plan-1", transaction_id: "txn-1", payee_id: "payee-1", payee_name: "Coffee Shop" },
      },
      CallToolResultSchema,
    );
    expect(payeeResult.isError).toBe(true);
    expect(firstText(payeeResult)).toContain("either payee_id or payee_name");
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });

  it("rejects invalid scoped transaction and delete inputs before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "invalid-scoped-transactions-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const categoryResult = await client.callTool(
      { name: "ynab_list_category_transactions", arguments: { plan_id: "plan-1", category_id: "   " } },
      CallToolResultSchema,
    );
    expect(categoryResult.isError).toBe(true);

    const payeeResult = await client.callTool(
      { name: "ynab_list_payee_transactions", arguments: { plan_id: "plan-1", payee_id: "   " } },
      CallToolResultSchema,
    );
    expect(payeeResult.isError).toBe(true);

    const accountResult = await client.callTool(
      { name: "ynab_list_account_transactions", arguments: { plan_id: "plan-1", account_id: "   " } },
      CallToolResultSchema,
    );
    expect(accountResult.isError).toBe(true);

    const limitResult = await client.callTool(
      { name: "ynab_list_account_transactions", arguments: { plan_id: "plan-1", account_id: "account-1", limit: 101 } },
      CallToolResultSchema,
    );
    expect(limitResult.isError).toBe(true);

    const monthResult = await client.callTool(
      { name: "ynab_list_month_transactions", arguments: { plan_id: "plan-1", month: "2026-13" } },
      CallToolResultSchema,
    );
    expect(monthResult.isError).toBe(true);

    const deleteResult = await client.callTool(
      { name: "ynab_delete_transaction", arguments: { plan_id: "plan-1", transaction_id: "   " } },
      CallToolResultSchema,
    );
    expect(deleteResult.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });

  it("rejects invalid scheduled transaction inputs before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "invalid-scheduled-transactions-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const listResult = await client.callTool(
      { name: "ynab_list_scheduled_transactions", arguments: { plan_id: "   " } },
      CallToolResultSchema,
    );
    expect(listResult.isError).toBe(true);

    const createResult = await client.callTool(
      {
        name: "ynab_create_scheduled_transaction",
        arguments: { plan_id: "plan-1", account_id: "account-1", date: "2026-07-15", amount: -12340, frequency: "monthly", payee_id: "payee-1", payee_name: "Coffee Shop" },
      },
      CallToolResultSchema,
    );
    expect(createResult.isError).toBe(true);
    expect(firstText(createResult)).toContain("either payee_id or payee_name");

    const emptyUpdateResult = await client.callTool(
      { name: "ynab_update_scheduled_transaction", arguments: { plan_id: "plan-1", scheduled_transaction_id: "sched-1" } },
      CallToolResultSchema,
    );
    expect(emptyUpdateResult.isError).toBe(true);
    expect(firstText(emptyUpdateResult)).toContain("At least one scheduled transaction field");

    const frequencyResult = await client.callTool(
      {
        name: "ynab_update_scheduled_transaction",
        arguments: { plan_id: "plan-1", scheduled_transaction_id: "sched-1", frequency: "sometimes" },
      },
      CallToolResultSchema,
    );
    expect(frequencyResult.isError).toBe(true);

    const deleteResult = await client.callTool(
      { name: "ynab_delete_scheduled_transaction", arguments: { plan_id: "plan-1", scheduled_transaction_id: "   " } },
      CallToolResultSchema,
    );
    expect(deleteResult.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });

  it("rejects invalid month/category budgeting inputs before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "invalid-month-category-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool(
      { name: "ynab_update_month_category", arguments: { plan_id: "plan-1", month: "2026-13", category_id: "cat-1", budgeted: 25000 } },
      CallToolResultSchema,
    );

    expect(result.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });

  it("rejects invalid payee inputs before calling YNAB", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp(testConfig({ devAuthBypass: true }), { fetchImpl });
    const url = await listen(app);

    const transport = new StreamableHTTPClientTransport(new URL("/mcp", url));
    const client = new Client({ name: "invalid-payee-smoke-test", version: "0.1.0" });
    await client.connect(transport);

    const result = await client.callTool(
      { name: "ynab_create_payee", arguments: { plan_id: "plan-1", name: "   " } },
      CallToolResultSchema,
    );

    expect(result.isError).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();

    await client.close();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function listen(app: ReturnType<typeof createApp>): Promise<URL> {
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  closeServer = () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP server address");
  }
  return new URL(`http://127.0.0.1:${address.port}`);
}

function firstText(result: unknown): string {
  const parsed = CallToolResultSchema.parse(result);
  const first = parsed.content[0];
  if (first?.type !== "text") {
    throw new Error("Expected text tool result");
  }
  return first.text;
}
