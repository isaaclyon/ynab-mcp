import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("parses a complete production-safe config", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      PORT: "8080",
      PUBLIC_BASE_URL: "https://ynab.example.test",
      YNAB_API_BASE_URL: "https://api.ynab.test/v1",
      YNAB_ACCESS_TOKEN: "test-token",
      OWNER_PASSPHRASE: "correct horse battery staple",
    });

    expect(config).toMatchObject({
      nodeEnv: "production",
      port: 8080,
      publicBaseUrl: new URL("https://ynab.example.test"),
      mcpUrl: new URL("https://ynab.example.test/mcp"),
      ynabApiBaseUrl: new URL("https://api.ynab.test/v1"),
      ynabAccessToken: "test-token",
      ownerPassphrase: "correct horse battery staple",
      devAuthBypass: false,
    });
  });

  it("allows dev auth bypass outside production without owner passphrase", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      DEV_AUTH_BYPASS: "true",
      YNAB_ACCESS_TOKEN: "test-token",
    });

    expect(config.devAuthBypass).toBe(true);
    expect(config.ownerPassphrase).toBeUndefined();
  });

  it("keeps config invariants inside the parser", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        DEV_AUTH_BYPASS: "true",
        YNAB_ACCESS_TOKEN: "test-token",
        PUBLIC_BASE_URL: "https://ynab.example.test",
      }),
    ).toThrow("DEV_AUTH_BYPASS must not be enabled in production");

    expect(() => loadConfig({ NODE_ENV: "test", YNAB_ACCESS_TOKEN: "test-token" })).toThrow(
      "OWNER_PASSPHRASE is required unless DEV_AUTH_BYPASS is enabled",
    );

    expect(() => loadConfig({ NODE_ENV: "test", DEV_AUTH_BYPASS: "true" })).toThrow(
      "YNAB_ACCESS_TOKEN is required",
    );
  });

  it("rejects malformed boundary values before constructing AppConfig", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        DEV_AUTH_BYPASS: "true",
        YNAB_ACCESS_TOKEN: "test-token",
        PORT: "70000",
      }),
    ).toThrow();

    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        DEV_AUTH_BYPASS: "true",
        YNAB_ACCESS_TOKEN: "test-token",
        PUBLIC_BASE_URL: "not-a-url",
      }),
    ).toThrow();
  });
});
