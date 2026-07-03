import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AppConfig } from "../config.js";
import { PrivateOAuthServer } from "../auth/oauth.js";
import { createMcpAuthMiddleware } from "../auth/middleware.js";
import { YnabClient } from "../ynab/client.js";
import { createMcpServer } from "../mcp/server.js";
import { isLoopbackUrl } from "./local.js";

export type AppDependencies = {
  ynabClient?: YnabClient;
  fetchImpl?: typeof fetch;
};

export function createApp(config: AppConfig, dependencies: AppDependencies = {}): Express {
  const app = express();
  app.set("trust proxy", true);

  const ynabClient =
    dependencies.ynabClient ??
    new YnabClient({
      baseUrl: config.ynabApiBaseUrl,
      accessToken: config.ynabAccessToken,
      ...(dependencies.fetchImpl ? { fetchImpl: dependencies.fetchImpl } : {}),
    });
  const oauthServer = new PrivateOAuthServer({
    issuerUrl: config.publicBaseUrl,
    resourceUrl: config.mcpUrl,
    ownerPassphrase: config.ownerPassphrase,
    ...(dependencies.fetchImpl ? { fetchImpl: dependencies.fetchImpl } : {}),
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(oauthServer.createRouter());
  app.use(
    "/mcp",
    createMcpAuthMiddleware({
      devAuthBypass: config.devAuthBypass && isLoopbackUrl(config.publicBaseUrl),
      oauthServer,
    }),
  );
  app.post("/mcp", express.json({ limit: "1mb" }), async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcpServer = createMcpServer(ynabClient);
    res.on("close", () => {
      void transport.close();
      void mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });
  app.get("/mcp", (_req, res) => {
    res.status(405).json({ error: "method_not_allowed", error_description: "Use POST for stateless MCP requests." });
  });

  return app;
}
