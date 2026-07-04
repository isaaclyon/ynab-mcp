import { afterEach, describe, expect, it, vi } from "vitest";
import { YnabApiError, YnabClient } from "../src/ynab/client.js";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("YnabClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { transactions: [] } }));
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

  it("captures retry-after seconds for upstream rate limits", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ error: { detail: "slow down" } }, { status: 429, headers: { "retry-after": "45" } }),
    );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await expect(client.listPlans()).rejects.toMatchObject({
      name: "YnabApiError",
      status: 429,
      retryAfterSeconds: 45,
    } satisfies Partial<YnabApiError>);
  });

  it("captures retry-after HTTP dates for upstream rate limits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:01:00.000Z"));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { error: { detail: "slow down" } },
        { status: 429, headers: { "retry-after": new Date("2026-07-03T00:01:30.000Z").toUTCString() } },
      ),
    );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await expect(client.listPlans()).rejects.toMatchObject({
      name: "YnabApiError",
      status: 429,
      retryAfterSeconds: 30,
    } satisfies Partial<YnabApiError>);
  });

  it("caches repeated GET requests within the read-through cache TTL", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { accounts: [{ id: "account-1" }] } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 60_000 },
    });

    const first = await client.listAccounts("plan-1");
    const second = await client.listAccounts("plan-1");

    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent GET requests for the same cache key", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(jsonResponse({ data: { plans: [{ id: "plan-1" }] } })), 10);
        }),
    );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    const [first, second] = await Promise.all([client.listPlans(), client.listPlans()]);

    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses no-change delta requests after cache expiry without refetching full account lists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:00:00.000Z"));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 10,
            accounts: [
              { id: "account-1", name: "Checking", balance: 0 },
              { id: "account-2", name: "Savings", balance: 1000 },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 11,
            accounts: [],
          },
        }),
      );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 10 },
    });

    await client.listAccounts("plan-1");
    vi.advanceTimersByTime(11);
    const refreshed = await client.listAccounts("plan-1");

    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
      "https://api.ynab.test/v1/plans/plan-1/accounts?last_knowledge_of_server=10",
    );
    expect(refreshed).toEqual({
      data: {
        server_knowledge: 11,
        accounts: [
          { id: "account-1", name: "Checking", balance: 0 },
          { id: "account-2", name: "Savings", balance: 1000 },
        ],
      },
    });
  });

  it("full-refreshes delta-supported reads when deltas contain changes to preserve upstream order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:00:00.000Z"));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 10,
            accounts: [
              { id: "account-1", name: "Checking", balance: 0 },
              { id: "account-2", name: "Savings", balance: 1000 },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 11,
            accounts: [{ id: "account-2", name: "Renamed Savings", balance: 2500 }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 11,
            accounts: [
              { id: "account-2", name: "Renamed Savings", balance: 2500 },
              { id: "account-1", name: "Checking", balance: 0 },
            ],
          },
        }),
      );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 10 },
    });

    await client.listAccounts("plan-1");
    vi.advanceTimersByTime(11);
    const refreshed = await client.listAccounts("plan-1");

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/accounts",
      "https://api.ynab.test/v1/plans/plan-1/accounts?last_knowledge_of_server=10",
      "https://api.ynab.test/v1/plans/plan-1/accounts",
    ]);
    expect(refreshed).toEqual({
      data: {
        server_knowledge: 11,
        accounts: [
          { id: "account-2", name: "Renamed Savings", balance: 2500 },
          { id: "account-1", name: "Checking", balance: 0 },
        ],
      },
    });
  });

  it("full-refreshes transaction reads after cache expiry because tool output is order and filter sensitive", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:00:00.000Z"));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 30,
            transactions: [{ id: "txn-old", date: "2026-07-01", amount: -1000 }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 31,
            transactions: [{ id: "txn-new", date: "2026-07-03", amount: -2000 }],
          },
        }),
      );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 10 },
    });

    await client.listTransactions("plan-1", "2026-07-02");
    vi.advanceTimersByTime(11);
    const refreshed = await client.listTransactions("plan-1", "2026-07-02");

    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe(
      "https://api.ynab.test/v1/plans/plan-1/transactions?since_date=2026-07-02",
    );
    expect(refreshed).toEqual({
      data: {
        server_knowledge: 31,
        transactions: [{ id: "txn-new", date: "2026-07-03", amount: -2000 }],
      },
    });
  });

  it("full-refreshes category reads when nested category deltas contain changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T00:00:00.000Z"));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 20,
            category_groups: [
              {
                id: "group-1",
                name: "Everyday",
                categories: [
                  { id: "cat-1", name: "Coffee", balance: 0 },
                  { id: "cat-2", name: "Groceries", balance: 1000 },
                ],
              },
              {
                id: "group-2",
                name: "Savings",
                categories: [{ id: "cat-3", name: "Emergency Fund", balance: 5000 }],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 21,
            category_groups: [
              {
                id: "group-2",
                categories: [{ id: "cat-1", name: "Coffee Beans", balance: 500 }],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            server_knowledge: 21,
            category_groups: [
              {
                id: "group-1",
                name: "Everyday",
                categories: [{ id: "cat-2", name: "Groceries", balance: 1000 }],
              },
              {
                id: "group-2",
                name: "Savings",
                categories: [
                  { id: "cat-3", name: "Emergency Fund", balance: 5000 },
                  { id: "cat-1", name: "Coffee Beans", balance: 500 },
                ],
              },
            ],
          },
        }),
      );
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 10 },
    });

    await client.listCategories("plan-1");
    vi.advanceTimersByTime(11);
    const refreshed = await client.listCategories("plan-1");

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/categories",
      "https://api.ynab.test/v1/plans/plan-1/categories?last_knowledge_of_server=20",
      "https://api.ynab.test/v1/plans/plan-1/categories",
    ]);
    expect(refreshed).toEqual({
      data: {
        server_knowledge: 21,
        category_groups: [
          {
            id: "group-1",
            name: "Everyday",
            categories: [{ id: "cat-2", name: "Groceries", balance: 1000 }],
          },
          {
            id: "group-2",
            name: "Savings",
            categories: [
              { id: "cat-3", name: "Emergency Fund", balance: 5000 },
              { id: "cat-1", name: "Coffee Beans", balance: 500 },
            ],
          },
        ],
      },
    });
  });

  it("clears cached reads after successful write requests", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { payees: [{ id: "payee-1", name: "Old Coffee" }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { payee: { id: "payee-2", name: "New Coffee" } } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { payees: [{ id: "payee-2", name: "New Coffee" }] } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
      cache: { ttlMs: 60_000 },
    });

    await client.listPayees("plan-1");
    await client.createPayee("plan-1", { name: "New Coffee" });
    const refreshed = await client.listPayees("plan-1");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(refreshed).toEqual({ data: { payees: [{ id: "payee-2", name: "New Coffee" }] } });
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

  it("builds scoped transaction list and delete requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { transactions: [] } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listCategoryTransactions("plan-1", "cat-1");
    await client.listAccountTransactions("plan-1", "account-1");
    await client.listPayeeTransactions("plan-1", "payee-1");
    await client.listMonthTransactions("plan-1", "2026-07");
    await client.deleteTransaction("plan-1", "txn-1");

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/categories/cat-1/transactions",
      "https://api.ynab.test/v1/plans/plan-1/accounts/account-1/transactions",
      "https://api.ynab.test/v1/plans/plan-1/payees/payee-1/transactions",
      "https://api.ynab.test/v1/plans/plan-1/months/2026-07-01/transactions",
      "https://api.ynab.test/v1/plans/plan-1/transactions/txn-1",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "GET", "GET", "GET", "DELETE"]);
    expect(fetchImpl.mock.calls[4]?.[1]?.body).toBeUndefined();
  });

  it("builds month category budgeting requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { category: { id: "cat-1" } } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listMonths("plan-1");
    await client.getMonth("plan-1", "2026-07");
    await client.getMonthCategory("plan-1", "2026-07", "cat-1");
    await client.updateMonthCategory("plan-1", "2026-07", "cat-1", { budgeted: 25000 });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/months",
      "https://api.ynab.test/v1/plans/plan-1/months/2026-07-01",
      "https://api.ynab.test/v1/plans/plan-1/months/2026-07-01/categories/cat-1",
      "https://api.ynab.test/v1/plans/plan-1/months/2026-07-01/categories/cat-1",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "GET", "GET", "PATCH"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({ category: { budgeted: 25000 } });
  });

  it("builds payee CRUD requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { payee: { id: "payee-1" } } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listPayees("plan-1");
    await client.createPayee("plan-1", { name: "Coffee Shop" });
    await client.getPayee("plan-1", "payee-1");
    await client.updatePayee("plan-1", "payee-1", { name: "Coffee Roaster" });

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/payees",
      "https://api.ynab.test/v1/plans/plan-1/payees",
      "https://api.ynab.test/v1/plans/plan-1/payees/payee-1",
      "https://api.ynab.test/v1/plans/plan-1/payees/payee-1",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST", "GET", "PATCH"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({ payee: { name: "Coffee Shop" } });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({ payee: { name: "Coffee Roaster" } });
  });

  it("builds scheduled transaction CRUD requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({ data: { scheduled_transaction: { id: "sched-1" } } }));
    const client = new YnabClient({
      baseUrl: new URL("https://api.ynab.test/v1"),
      accessToken: "secret-token",
      fetchImpl,
    });

    await client.listScheduledTransactions("plan-1");
    await client.createScheduledTransaction("plan-1", {
      account_id: "account-1",
      date: "2026-07-15",
      amount: -12340,
      frequency: "monthly",
      payee_name: "Coffee Shop",
      category_id: "cat-1",
      memo: "Beans",
      flag_color: "green",
    });
    await client.getScheduledTransaction("plan-1", "sched-1");
    await client.updateScheduledTransaction("plan-1", "sched-1", { memo: null, frequency: "weekly" });
    await client.deleteScheduledTransaction("plan-1", "sched-1");

    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.ynab.test/v1/plans/plan-1/scheduled_transactions",
      "https://api.ynab.test/v1/plans/plan-1/scheduled_transactions",
      "https://api.ynab.test/v1/plans/plan-1/scheduled_transactions/sched-1",
      "https://api.ynab.test/v1/plans/plan-1/scheduled_transactions/sched-1",
      "https://api.ynab.test/v1/plans/plan-1/scheduled_transactions/sched-1",
    ]);
    expect(fetchImpl.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "POST", "GET", "PUT", "DELETE"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      scheduled_transaction: {
        account_id: "account-1",
        date: "2026-07-15",
        amount: -12340,
        frequency: "monthly",
        payee_name: "Coffee Shop",
        category_id: "cat-1",
        memo: "Beans",
        flag_color: "green",
      },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[3]?.[1]?.body))).toEqual({ scheduled_transaction: { memo: null, frequency: "weekly" } });
    expect(fetchImpl.mock.calls[4]?.[1]?.body).toBeUndefined();
  });
});
