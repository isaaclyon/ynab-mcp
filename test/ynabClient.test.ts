import { describe, expect, it, vi } from "vitest";
import { YnabApiError, YnabClient } from "../src/ynab/client.js";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("YnabClient", () => {
  it("builds authenticated plan-scoped GET requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { accounts: [] } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listAccounts("plan-1");

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/accounts");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("adds transaction since_date without leaking token into URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { transactions: [] } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1/"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listTransactions("plan-1", "2026-07-01");

    const [url] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/transactions?since_date=2026-07-01");
    expect(String(url)).not.toContain("secret-token");
  });

  it("throws a typed error for upstream failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { detail: "nope" } }, { status: 401 }),
    );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await expect(client.listPlans()).rejects.toMatchObject({
      name: "YnabApiError",
      status: 401,
      body: { error: { detail: "nope" } },
    } satisfies Partial<YnabApiError>);
  });
});
