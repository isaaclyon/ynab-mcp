export type YnabClientConfig = {
  baseUrl: URL;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

export type CategoryGroupInput = {
  name: string;
};

export type CategoryInput = {
  name?: string | null;
  note?: string | null;
  category_group_id?: string;
  goal_target?: number | null;
  goal_target_date?: string | null;
  goal_needs_whole_amount?: boolean | null;
};

export type CreateTransactionInput = {
  account_id: string;
  date: string;
  amount: number;
  payee_id?: string;
  payee_name?: string;
  category_id?: string | null;
  memo?: string | null;
  cleared?: "cleared" | "uncleared" | "reconciled";
  approved?: boolean;
  flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple" | null;
  import_id?: string;
};

export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, "import_id">>;

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
    return this.request("GET", "/plans");
  }

  listAccounts(planId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/accounts`);
  }

  listCategories(planId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/categories`);
  }

  getCategory(planId: string, categoryId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}`);
  }

  createCategory(planId: string, category: CategoryInput & { name: string; category_group_id: string }): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/categories`, undefined, { category });
  }

  updateCategory(planId: string, categoryId: string, category: CategoryInput): Promise<unknown> {
    return this.request("PATCH", `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}`, undefined, {
      category,
    });
  }

  createCategoryGroup(planId: string, categoryGroup: CategoryGroupInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/category_groups`, undefined, {
      category_group: categoryGroup,
    });
  }

  updateCategoryGroup(planId: string, categoryGroupId: string, categoryGroup: CategoryGroupInput): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/category_groups/${encodeURIComponent(categoryGroupId)}`,
      undefined,
      { category_group: categoryGroup },
    );
  }

  getMonth(planId: string, month: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(month)}`);
  }

  listTransactions(planId: string, sinceDate?: string): Promise<unknown> {
    const query = sinceDate ? { since_date: sinceDate } : undefined;
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/transactions`, query);
  }

  getTransaction(planId: string, transactionId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`);
  }

  createTransaction(planId: string, transaction: CreateTransactionInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/transactions`, undefined, { transaction });
  }

  updateTransaction(planId: string, transactionId: string, transaction: UpdateTransactionInput): Promise<unknown> {
    return this.request("PUT", `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`, undefined, {
      transaction,
    });
  }

  private async request(
    method: "GET" | "POST" | "PATCH" | "PUT",
    path: string,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<unknown> {
    const url = new URL(path.replace(/^\//, ""), appendSlash(this.baseUrl));
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const responseBody = await readJsonBody(response);
    if (!response.ok) {
      throw new YnabApiError(`YNAB API request failed with status ${response.status}`, response.status, responseBody);
    }
    return responseBody;
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
