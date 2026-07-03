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
});

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
