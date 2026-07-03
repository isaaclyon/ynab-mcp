export type YnabClientConfig = {
  baseUrl: URL;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

export class YnabApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "YnabApiError";
  }
}

export class YnabClient {
  private readonly baseUrl: URL;
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: YnabClientConfig) {
    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  listPlans(): Promise<unknown> {
    return this.get("/plans");
  }

  listAccounts(planId: string): Promise<unknown> {
    return this.get(`/plans/${encodeURIComponent(planId)}/accounts`);
  }

  listCategories(planId: string): Promise<unknown> {
    return this.get(`/plans/${encodeURIComponent(planId)}/categories`);
  }

  getMonth(planId: string, month: string): Promise<unknown> {
    return this.get(`/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(month)}`);
  }

  listTransactions(planId: string, sinceDate?: string): Promise<unknown> {
    const query = sinceDate ? { since_date: sinceDate } : undefined;
    return this.get(`/plans/${encodeURIComponent(planId)}/transactions`, query);
  }

  getTransaction(planId: string, transactionId: string): Promise<unknown> {
    return this.get(
      `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`,
    );
  }

  private async get(path: string, query?: Record<string, string>): Promise<unknown> {
    const url = new URL(path.replace(/^\//, ""), appendSlash(this.baseUrl));
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const body = await readJsonBody(response);
    if (!response.ok) {
      throw new YnabApiError(`YNAB API request failed with status ${response.status}`, response.status, body);
    }
    return body;
  }
}

function appendSlash(url: URL): URL {
  const copy = new URL(url.href);
  if (!copy.pathname.endsWith("/")) {
    copy.pathname = `${copy.pathname}/`;
  }
  return copy;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
