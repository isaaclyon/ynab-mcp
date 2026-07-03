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
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_category");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_create_transaction");
    expect(tools.tools.map((tool) => tool.name)).toContain("ynab_update_transaction");
    expect(tools.tools.find((tool) => tool.name === "ynab_list_plans")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
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

    const result = await client.callTool({ name: "ynab_list_plans", arguments: {} }, CallToolResultSchema);
    const text = firstText(result);
    expect(JSON.parse(text) as unknown).toEqual({
      plans: [{ id: "plan-1", name: "Personal" }],
    });

    await client.close();
  });

  it("handles concurrent stateless tool calls without reusing a connected MCP server", async () => {
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
    expect(fetchImpl).toHaveBeenCalledTimes(2);

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
