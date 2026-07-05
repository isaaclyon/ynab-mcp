import type { AppConfig } from "../src/config.js";

type AppConfigOverrides = Omit<Partial<AppConfig>, "ownerPassphrase"> & {
  ownerPassphrase?: string | undefined;
};

export function testConfig(overrides: AppConfigOverrides = {}): AppConfig {
  const publicBaseUrl = new URL("http://localhost:3000");
  const base: AppConfig = {
    nodeEnv: "test",
    port: 3000,
    publicBaseUrl,
    mcpUrl: new URL("/mcp", publicBaseUrl),
    ynabApiBaseUrl: new URL("https://api.ynab.test/v1"),
    ynabAccessToken: "test-ynab-token",
    ownerPassphrase: "correct horse battery staple",
    devAuthBypass: false,
  };
  const { ownerPassphrase, ...otherOverrides } = overrides;
  const config: AppConfig = { ...base, ...otherOverrides };
  if ("ownerPassphrase" in overrides) {
    if (ownerPassphrase === undefined) {
      delete config.ownerPassphrase;
    } else {
      config.ownerPassphrase = ownerPassphrase;
    }
  }
  return config;
}
