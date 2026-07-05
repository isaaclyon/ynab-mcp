import { createHash } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { createApp } from "../src/http/app.js";
import { testConfig } from "./testConfig.js";

const CLIENT_ID = "https://client.example.test/metadata.json";
const REDIRECT_URI = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CHALLENGE = base64Url(createHash("sha256").update(VERIFIER).digest());

function clientMetadataResponse(): Response {
  return new Response(
    JSON.stringify({
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name: "Claude test client",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("private OAuth scaffold", () => {
  it("advertises CIMD and no client registration endpoint", async () => {
    const app = createApp(testConfig());

    const response = await request(app).get("/.well-known/oauth-authorization-server").expect(200);

    expect(response.body).toMatchObject({
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
    });
    expect(response.body.registration_endpoint).toBeUndefined();
  });

  it("keeps the MCP endpoint authenticated by default", async () => {
    const app = createApp(testConfig());

    const response = await request(app).post("/mcp").send({}).expect(401);

    expect(response.header["www-authenticate"]).toContain("resource_metadata");
  });

  it("does not apply dev auth bypass for public base URLs or forwarded traffic", async () => {
    await request(
      createApp(
        testConfig({
          devAuthBypass: true,
          publicBaseUrl: new URL("https://ynab.example.test"),
          mcpUrl: new URL("https://ynab.example.test/mcp"),
        }),
      ),
    )
      .post("/mcp")
      .send({})
      .expect(401);

    await request(createApp(testConfig({ devAuthBypass: true })))
      .post("/mcp")
      .set("x-forwarded-for", "203.0.113.10")
      .send({})
      .expect(401);
  });

  it("exchanges an owner-passphrase-gated PKCE authorization code for bearer tokens", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(clientMetadataResponse());
    const app = createApp(testConfig(), { fetchImpl });

    const authorizeParams = {
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
      resource: "http://localhost:3000/mcp",
      state: "state-1",
      scope: "ynab:read",
      owner_passphrase: "correct horse battery staple",
    };

    const authorizeResponse = await request(app)
      .post("/authorize")
      .type("form")
      .send(authorizeParams)
      .expect(302);
    const location = new URL(assertHeader(authorizeResponse.header["location"]));
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get("state")).toBe("state-1");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: VERIFIER,
      })
      .expect(400);

    const tokenResponse = await request(app)
      .post("/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code,
        code_verifier: VERIFIER,
        redirect_uri: REDIRECT_URI,
      })
      .expect(200);

    expect(tokenResponse.body).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "ynab:read",
    });
    expect(typeof tokenResponse.body.access_token).toBe("string");
    expect(typeof tokenResponse.body.refresh_token).toBe("string");
  });

  it("does not authorize with a known fallback passphrase when owner passphrase is omitted", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(clientMetadataResponse());
    const app = createApp(testConfig({ ownerPassphrase: undefined, devAuthBypass: true }), {
      fetchImpl,
    });

    await request(app)
      .post("/authorize")
      .type("form")
      .send({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: CHALLENGE,
        code_challenge_method: "S256",
        resource: "http://localhost:3000/mcp",
        owner_passphrase: "dev-auth-bypass-only",
      })
      .expect(503);
  });

  it("handles CIMD fetch failures as invalid clients instead of uncaught errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("network failed"));
    const app = createApp(testConfig(), { fetchImpl });

    const response = await request(app)
      .get("/authorize")
      .query({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: CHALLENGE,
        code_challenge_method: "S256",
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: "invalid_request",
      error_description: "Unknown client_id",
    });
  });

  it("rejects dev auth bypass in production config", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DEV_AUTH_BYPASS: "true",
        YNAB_ACCESS_TOKEN: "test-token",
        PUBLIC_BASE_URL: "https://ynab.example.test",
      }),
    ).toThrow("DEV_AUTH_BYPASS must not be enabled in production");
  });
});

function assertHeader(value: string | undefined): string {
  if (!value) {
    throw new Error("Expected response header");
  }
  return value;
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
