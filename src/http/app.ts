import express, { type Express } from "express";
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AppConfig } from "../config.js";
import { PrivateOAuthServer } from "../auth/oauth.js";
import type { PrivateOAuthConfig } from "../auth/oauth.js";
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
  const oauthConfig = {
    issuerUrl: config.publicBaseUrl,
    resourceUrl: config.mcpUrl,
    ...(config.ownerPassphrase === undefined ? {} : { ownerPassphrase: config.ownerPassphrase }),
    ...(dependencies.fetchImpl ? { fetchImpl: dependencies.fetchImpl } : {}),
  } satisfies PrivateOAuthConfig;
  const oauthServer = new PrivateOAuthServer(oauthConfig);

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
    const transport = new StreamableHTTPServerTransport(statelessTransportOptions());
    const mcpServer = createMcpServer(ynabClient);
    res.on("close", () => {
      void transport.close();
      void mcpServer.close();
    });

    try {
      await mcpServer.connect(transport as Transport);
      await transport.handleRequest(req, res, req.body);
    } catch (_error) {
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
    res.status(405).json({
      error: "method_not_allowed",
      error_description: "Use POST for stateless MCP requests.",
    });
  });

  return app;
}

function statelessTransportOptions(): StreamableHTTPServerTransportOptions {
  // The MCP SDK documents explicit `undefined` as the stateless Streamable HTTP mode,
  // but its published types are not exact-optional clean under TypeScript's strictest mode.
  return { sessionIdGenerator: undefined } as unknown as StreamableHTTPServerTransportOptions;
}
