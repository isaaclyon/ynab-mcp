import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import { z } from "zod";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export const MCP_SCOPE = "ynab:read";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;

export type PrivateOAuthConfig = {
  issuerUrl: URL;
  resourceUrl: URL;
  ownerPassphrase?: string;
  fetchImpl?: typeof fetch;
};

type AuthorizationCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  resource: URL;
  expiresAtMs: number;
};

type StoredToken = {
  token: string;
  clientId: string;
  scopes: string[];
  resource: URL;
  expiresAtSeconds: number;
};

type StoredRefreshToken = {
  token: string;
  clientId: string;
  scopes: string[];
  resource: URL;
};

const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.url(),
  redirect_uri: z.url(),
  code_challenge: z.string().min(32),
  code_challenge_method: z.literal("S256"),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.url().optional(),
});

const tokenBodySchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"]),
  client_id: z.url(),
  code: z.string().optional(),
  code_verifier: z.string().optional(),
  redirect_uri: z.url().optional(),
  refresh_token: z.string().optional(),
  resource: z.url().optional(),
});

const clientMetadataSchema = z.object({
  redirect_uris: z.array(z.url()).min(1),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  client_name: z.string().optional(),
});

type ClientMetadata = z.infer<typeof clientMetadataSchema>;

type AuthorizeParams = z.infer<typeof authorizeQuerySchema>;

type TokenBody = z.infer<typeof tokenBodySchema>;

export class PrivateOAuthServer {
  private readonly issuerUrl: URL;
  private readonly resourceUrl: URL;
  private readonly ownerPassphrase: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly clients = new Map<string, OAuthClientInformationFull>();
  private readonly authorizationCodes = new Map<string, AuthorizationCode>();
  private readonly accessTokens = new Map<string, StoredToken>();
  private readonly refreshTokens = new Map<string, StoredRefreshToken>();

  constructor(config: PrivateOAuthConfig) {
    this.issuerUrl = config.issuerUrl;
    this.resourceUrl = config.resourceUrl;
    this.ownerPassphrase = config.ownerPassphrase;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  createRouter(): Router {
    const router = express.Router();
    router.get("/.well-known/oauth-authorization-server", (_req, res) => {
      res.json(this.authorizationServerMetadata());
    });
    router.get("/.well-known/oauth-protected-resource/mcp", (_req, res) => {
      res.json(this.protectedResourceMetadata());
    });
    router.get(
      "/authorize",
      asyncHandler((req, res) => this.handleAuthorizeGet(req, res)),
    );
    router.post(
      "/authorize",
      express.urlencoded({ extended: false }),
      asyncHandler((req, res) => this.handleAuthorizePost(req, res)),
    );
    router.post(
      "/token",
      express.urlencoded({ extended: false }),
      express.json(),
      asyncHandler((req, res) => this.handleToken(req, res)),
    );
    router.use(oauthErrorHandler);
    return router;
  }

  protectedResourceMetadataUrl(): string {
    return new URL("/.well-known/oauth-protected-resource/mcp", this.issuerUrl).href;
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const stored = this.accessTokens.get(token);
    if (!stored) {
      throw new Error("Invalid access token");
    }
    if (stored.expiresAtSeconds < Math.floor(Date.now() / 1000)) {
      this.accessTokens.delete(token);
      throw new Error("Expired access token");
    }
    if (stripHash(stored.resource.href) !== stripHash(this.resourceUrl.href)) {
      throw new Error("Access token audience does not match this MCP resource");
    }
    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: stored.expiresAtSeconds,
      resource: stored.resource,
    };
  }

  private async handleAuthorizeGet(req: Request, res: Response): Promise<void> {
    if (!this.ownerPassphrase) {
      res.status(503).json(oauthError("server_error", "Owner passphrase is not configured"));
      return;
    }

    const parsed = authorizeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(oauthError("invalid_request", parsed.error.message));
      return;
    }

    const client = await this.getClient(parsed.data.client_id);
    const validation = this.validateAuthorizeRequest(parsed.data, client);
    if (!validation.ok) {
      res.status(400).json(oauthError("invalid_request", validation.message));
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderAuthorizePage(parsed.data));
  }

  private async handleAuthorizePost(req: Request, res: Response): Promise<void> {
    if (!this.ownerPassphrase) {
      res.status(503).json(oauthError("server_error", "Owner passphrase is not configured"));
      return;
    }

    const requestBody: unknown = req.body;
    const parsed = authorizeQuerySchema.safeParse(requestBody);
    if (!parsed.success) {
      res.status(400).json(oauthError("invalid_request", parsed.error.message));
      return;
    }

    const passphrase = ownerPassphraseFromBody(requestBody);
    if (!secureEqual(passphrase, this.ownerPassphrase)) {
      res.status(403).type("html").send(renderAuthorizePage(parsed.data, "Invalid passphrase."));
      return;
    }

    const client = await this.getClient(parsed.data.client_id);
    const validation = this.validateAuthorizeRequest(parsed.data, client);
    if (!validation.ok) {
      res.status(400).json(oauthError("invalid_request", validation.message));
      return;
    }

    const code = randomToken();
    const resource = new URL(parsed.data.resource ?? this.resourceUrl.href);
    this.authorizationCodes.set(code, {
      code,
      clientId: parsed.data.client_id,
      redirectUri: parsed.data.redirect_uri,
      codeChallenge: parsed.data.code_challenge,
      scopes: parseScopes(parsed.data.scope),
      resource,
      expiresAtMs: Date.now() + AUTHORIZATION_CODE_TTL_MS,
    });

    const redirectUrl = new URL(parsed.data.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (parsed.data.state) {
      redirectUrl.searchParams.set("state", parsed.data.state);
    }
    res.redirect(302, redirectUrl.href);
  }

  private async handleToken(req: Request, res: Response): Promise<void> {
    const parsed = tokenBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(oauthError("invalid_request", parsed.error.message));
      return;
    }

    const client = await this.getClient(parsed.data.client_id);
    if (!client) {
      res.status(400).json(oauthError("invalid_client", "Unknown client_id"));
      return;
    }

    if (parsed.data.grant_type === "authorization_code") {
      this.handleAuthorizationCodeGrant(parsed.data, res);
      return;
    }

    this.handleRefreshTokenGrant(parsed.data, res);
  }

  private handleAuthorizationCodeGrant(body: TokenBody, res: Response): void {
    if (!body.code || !body.code_verifier || !body.redirect_uri) {
      res
        .status(400)
        .json(oauthError("invalid_request", "code, code_verifier, and redirect_uri are required"));
      return;
    }

    const code = this.authorizationCodes.get(body.code);
    if (!code || code.clientId !== body.client_id || code.expiresAtMs < Date.now()) {
      res.status(400).json(oauthError("invalid_grant", "Invalid or expired authorization code"));
      return;
    }
    if (body.redirect_uri && body.redirect_uri !== code.redirectUri) {
      res
        .status(400)
        .json(oauthError("invalid_grant", "redirect_uri does not match authorization request"));
      return;
    }
    if (!verifyPkce(body.code_verifier, code.codeChallenge)) {
      res
        .status(400)
        .json(oauthError("invalid_grant", "code_verifier does not match code_challenge"));
      return;
    }

    this.authorizationCodes.delete(body.code);
    res.json(this.issueTokens(code.clientId, code.scopes, code.resource));
  }

  private handleRefreshTokenGrant(body: TokenBody, res: Response): void {
    if (!body.refresh_token) {
      res.status(400).json(oauthError("invalid_request", "refresh_token is required"));
      return;
    }

    const stored = this.refreshTokens.get(body.refresh_token);
    if (!stored || stored.clientId !== body.client_id) {
      res.status(400).json(oauthError("invalid_grant", "Invalid refresh token"));
      return;
    }

    const requestedResource = body.resource ? new URL(body.resource) : stored.resource;
    if (stripHash(requestedResource.href) !== stripHash(stored.resource.href)) {
      res
        .status(400)
        .json(oauthError("invalid_target", "Refresh token cannot be used for that resource"));
      return;
    }

    res.json(this.issueTokens(stored.clientId, stored.scopes, stored.resource, stored.token));
  }

  private issueTokens(
    clientId: string,
    scopes: string[],
    resource: URL,
    existingRefreshToken?: string,
  ): OAuthTokens {
    const accessToken = randomToken();
    const refreshToken = existingRefreshToken ?? randomToken();
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

    this.accessTokens.set(accessToken, {
      token: accessToken,
      clientId,
      scopes,
      resource,
      expiresAtSeconds,
    });
    this.refreshTokens.set(refreshToken, { token: refreshToken, clientId, scopes, resource });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: scopes.join(" "),
      refresh_token: refreshToken,
    };
  }

  private validateAuthorizeRequest(
    params: AuthorizeParams,
    client: OAuthClientInformationFull | undefined,
  ): { ok: true } | { ok: false; message: string } {
    if (!client) {
      return { ok: false, message: "Unknown client_id" };
    }
    if (!client.redirect_uris.includes(params.redirect_uri)) {
      return { ok: false, message: "redirect_uri is not allowed for this client" };
    }
    const resource = new URL(params.resource ?? this.resourceUrl.href);
    if (stripHash(resource.href) !== stripHash(this.resourceUrl.href)) {
      return { ok: false, message: "resource must match this MCP server" };
    }
    return { ok: true };
  }

  private async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const cached = this.clients.get(clientId);
    if (cached) {
      return cached;
    }

    let documentUrl: URL;
    try {
      documentUrl = new URL(clientId);
    } catch {
      return undefined;
    }
    if (documentUrl.protocol !== "https:" && documentUrl.hostname !== "localhost") {
      return undefined;
    }

    let response: globalThis.Response;
    try {
      response = await this.fetchImpl(documentUrl, { headers: { Accept: "application/json" } });
    } catch {
      return undefined;
    }
    if (!response.ok) {
      return undefined;
    }

    let clientMetadata: unknown;
    try {
      clientMetadata = await response.json();
    } catch {
      return undefined;
    }
    const metadata = clientMetadataSchema.safeParse(clientMetadata);
    if (!metadata.success || !metadataAllowed(metadata.data)) {
      return undefined;
    }

    const client: OAuthClientInformationFull = {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: metadata.data.redirect_uris,
      token_endpoint_auth_method: metadata.data.token_endpoint_auth_method ?? "none",
      grant_types: metadata.data.grant_types ?? ["authorization_code", "refresh_token"],
      response_types: metadata.data.response_types ?? ["code"],
      ...(metadata.data.client_name ? { client_name: metadata.data.client_name } : {}),
    };
    this.clients.set(clientId, client);
    return client;
  }

  private authorizationServerMetadata(): Record<string, unknown> {
    return {
      issuer: this.issuerUrl.href,
      authorization_endpoint: new URL("/authorize", this.issuerUrl).href,
      token_endpoint: new URL("/token", this.issuerUrl).href,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      scopes_supported: [MCP_SCOPE],
    };
  }

  private protectedResourceMetadata(): Record<string, unknown> {
    return {
      resource: this.resourceUrl.href,
      authorization_servers: [this.issuerUrl.href],
      scopes_supported: [MCP_SCOPE],
      resource_name: "Personal YNAB MCP server",
    };
  }
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

function oauthErrorHandler(
  _error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }
  res.status(500).json(oauthError("server_error", "Internal authorization server error"));
}

function renderAuthorizePage(params: AuthorizeParams, error?: string): string {
  const hiddenInputs = Object.entries(params)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Authorize YNAB MCP</title></head>
  <body>
    <main>
      <h1>Authorize personal YNAB MCP connector</h1>
      <p>Enter the owner passphrase to let this Claude connector call the authenticated MCP server.</p>
      ${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/authorize">
        ${hiddenInputs}
        <label>Owner passphrase <input name="owner_passphrase" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Authorize</button>
      </form>
    </main>
  </body>
</html>`;
}

function metadataAllowed(metadata: ClientMetadata): boolean {
  return (
    (metadata.token_endpoint_auth_method === undefined ||
      metadata.token_endpoint_auth_method === "none") &&
    (metadata.grant_types === undefined || metadata.grant_types.includes("authorization_code")) &&
    (metadata.response_types === undefined || metadata.response_types.includes("code"))
  );
}

function parseScopes(scope: string | undefined): string[] {
  const requested = scope?.split(" ").filter(Boolean) ?? [MCP_SCOPE];
  return requested.includes(MCP_SCOPE) ? requested : [...requested, MCP_SCOPE];
}

function verifyPkce(verifier: string, challenge: string): boolean {
  return base64Url(createHash("sha256").update(verifier).digest()) === challenge;
}

function randomToken(): string {
  return base64Url(randomBytes(32));
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function secureEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function oauthError(error: string, errorDescription: string): Record<string, string> {
  return { error, error_description: errorDescription };
}

function ownerPassphraseFromBody(body: unknown): string {
  if (!isRecord(body)) {
    return "";
  }
  const value = body["owner_passphrase"];
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripHash(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
