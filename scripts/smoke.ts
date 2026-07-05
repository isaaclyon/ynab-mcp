import { createServer } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createApp } from "../src/http/app.js";
import type { AppConfig } from "../src/config.js";

const publicBaseUrl = new URL("http://127.0.0.1:0");
const config: AppConfig = {
  nodeEnv: "test",
  port: 0,
  publicBaseUrl,
  mcpUrl: new URL("/mcp", publicBaseUrl),
  ynabApiBaseUrl: new URL("https://api.ynab.smoke/v1"),
  ynabAccessToken: "smoke-token",
  devAuthBypass: true,
};

const ynabFetch: typeof fetch = async (url) => {
  const requestUrl = new URL(String(url));
  if (requestUrl.pathname === "/v1/plans") {
    return json({ data: { plans: [{ id: "smoke-plan", name: "Smoke Plan" }] } });
  }
  return json({ error: { detail: `Unhandled smoke YNAB path ${requestUrl.pathname}` } }, 404);
};

const app = createApp(config, { fetchImpl: ynabFetch });
const server = createServer(app);

try {
  const baseUrl = await listen(server);
  const client = new Client({ name: "ynab-mcp-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL("/mcp", baseUrl));
  await connectClient(client, transport);

  const tools = await client.listTools();
  if (!tools.tools.some((tool) => tool.name === "ynab_list_plans")) {
    throw new Error("tools/list did not include ynab_list_plans");
  }

  const result = await client.callTool(
    { name: "ynab_list_plans", arguments: {} },
    CallToolResultSchema,
  );
  const text = firstText(result);
  if (!text.includes("smoke-plan")) {
    throw new Error("ynab_list_plans smoke call did not return mocked plan");
  }

  await client.close();
  console.log(
    "Smoke check passed: initialize, tools/list, and ynab_list_plans tool call succeeded.",
  );
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    }),
  );
}

async function connectClient(
  client: Client,
  transport: StreamableHTTPClientTransport,
): Promise<void> {
  await client.connect(transport as Transport);
}

function listen(httpServer: typeof server): Promise<URL> {
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (typeof address !== "object" || address === null) {
        throw new Error("Expected TCP server address");
      }
      resolve(new URL(`http://127.0.0.1:${address.port}`));
    });
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function firstText(result: unknown): string {
  const parsed = CallToolResultSchema.parse(result);
  const first = parsed.content[0];
  if (first?.type !== "text") {
    throw new Error("Expected text tool result");
  }
  return first.text;
}
