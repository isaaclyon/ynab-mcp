import type { AppConfig } from "../src/config.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const publicBaseUrl = new URL("http://localhost:3000");
  return {
    nodeEnv: "test",
    port: 3000,
    publicBaseUrl,
    mcpUrl: new URL("/mcp", publicBaseUrl),
    ynabApiBaseUrl: new URL("https://api.ynab.test/v1"),
    ynabAccessToken: "test-ynab-token",
    ownerPassphrase: "correct horse battery staple",
    devAuthBypass: false,
    ...overrides,
  };
}
