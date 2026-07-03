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

  it("creates categories with the expected wrapper", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { category: { id: "cat-1" } } }, { status: 201 }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.createCategory("plan-1", {
      category_group_id: "group-1",
      name: "Coffee",
      note: "Monthly coffee target",
      goal_target: 50000,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/categories");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json", Authorization: "Bearer secret-token" });
    expect(JSON.parse(String(init?.body))).toEqual({
      category: { category_group_id: "group-1", name: "Coffee", note: "Monthly coffee target", goal_target: 50000 },
    });
  });


  it("creates category groups with the expected wrapper", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { category_group: { id: "group-1" } } }, { status: 201 }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.createCategoryGroup("plan-1", { name: "Flexible" });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/category_groups");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ category_group: { name: "Flexible" } });
  });

  it("updates categories and category groups with PATCH", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { category_group: { id: "group-1" } } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.updateCategoryGroup("plan-1", "group-1", { name: "Flexible" });
    await client.updateCategory("plan-1", "cat-1", { name: "Coffee Beans", note: null });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/category_groups/group-1",
      "https://api.ynab.test/v1/plans/plan-1/categories/cat-1",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["PATCH", "PATCH"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({ category: { name: "Coffee Beans", note: null } });
  });

  it("creates transactions with the expected wrapper", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { transaction: { id: "txn-1" } } }, { status: 201 }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.createTransaction("plan-1", {
      account_id: "account-1",
      date: "2026-07-03",
      amount: -12340,
      payee_name: "Coffee Shop",
      category_id: "cat-1",
      memo: "Beans",
      cleared: "cleared",
      approved: true,
      flag_color: "blue",
      import_id: "YNAB:-12340:2026-07-03:1",
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/transactions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json", Authorization: "Bearer secret-token" });
    expect(JSON.parse(String(init?.body))).toEqual({
      transaction: {
        account_id: "account-1",
        date: "2026-07-03",
        amount: -12340,
        payee_name: "Coffee Shop",
        category_id: "cat-1",
        memo: "Beans",
        cleared: "cleared",
        approved: true,
        flag_color: "blue",
        import_id: "YNAB:-12340:2026-07-03:1",
      },
    });
  });

  it("updates transactions with PUT and a transaction wrapper", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { transaction: { id: "txn-1" } } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.updateTransaction("plan-1", "txn-1", { memo: null, approved: false, category_id: null });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.ynab.test/v1/plans/plan-1/transactions/txn-1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ transaction: { memo: null, approved: false, category_id: null } });
  });
});
