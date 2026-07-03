import { z } from "zod";

const booleanFromEnv = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  YNAB_API_BASE_URL: z.string().url().default("https://api.ynab.com/v1"),
  YNAB_ACCESS_TOKEN: z.string().min(1).optional(),
  OWNER_PASSPHRASE: z.string().min(16).optional(),
  DEV_AUTH_BYPASS: booleanFromEnv.default(false),
});

export type AppConfig = {
  nodeEnv: string;
  port: number;
  publicBaseUrl: URL;
  mcpUrl: URL;
  ynabApiBaseUrl: URL;
  ynabAccessToken: string;
  ownerPassphrase?: string;
  devAuthBypass: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  if (parsed.DEV_AUTH_BYPASS && parsed.NODE_ENV === "production") {
    throw new Error("DEV_AUTH_BYPASS must not be enabled in production");
  }

  if (!parsed.DEV_AUTH_BYPASS && !parsed.OWNER_PASSPHRASE) {
    throw new Error("OWNER_PASSPHRASE is required unless DEV_AUTH_BYPASS is enabled");
  }

  const token = parsed.YNAB_ACCESS_TOKEN;
  if (!token) {
    throw new Error("YNAB_ACCESS_TOKEN is required");
  }

  const publicBaseUrl = new URL(parsed.PUBLIC_BASE_URL);
  const mcpUrl = new URL("/mcp", publicBaseUrl);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    publicBaseUrl,
    mcpUrl,
    ynabApiBaseUrl: new URL(parsed.YNAB_API_BASE_URL),
    ynabAccessToken: token,
    ...(parsed.OWNER_PASSPHRASE ? { ownerPassphrase: parsed.OWNER_PASSPHRASE } : {}),
    devAuthBypass: parsed.DEV_AUTH_BYPASS,
  };
}
