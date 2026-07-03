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
    expect(tools.tools.find((tool) => tool.name === "ynab_list_plans")?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
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
