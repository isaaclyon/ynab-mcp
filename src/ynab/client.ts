export type YnabClientConfig = {
  baseUrl: URL;
  accessToken: string;
  fetchImpl?: typeof fetch;
  cache?: YnabClientCacheConfig;
};

export type YnabClientCacheConfig = {
  enabled?: boolean;
  ttlMs?: number;
};

type YnabHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type CacheEntry = {
  value: unknown;
  expiresAtMs: number;
  serverKnowledge?: number;
};

type JsonRecord = Record<string, unknown>;

const DEFAULT_READ_CACHE_TTL_MS = 30_000;
const DELTA_SUPPORTED_GET_PATHS = [
  /^\/plans\/[^/]+\/accounts$/,
  /^\/plans\/[^/]+\/categories$/,
  /^\/plans\/[^/]+\/payees$/,
] as const;

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

export type ScheduledTransactionInput = {
  account_id: string;
  date: string;
  amount: number;
  frequency:
    | "never"
    | "daily"
    | "weekly"
    | "everyOtherWeek"
    | "twiceAMonth"
    | "every4Weeks"
    | "monthly"
    | "everyOtherMonth"
    | "every3Months"
    | "every4Months"
    | "twiceAYear"
    | "yearly"
    | "everyOtherYear";
  payee_id?: string;
  payee_name?: string;
  category_id?: string | null;
  memo?: string | null;
  flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple" | null;
};

export type UpdateScheduledTransactionInput = Partial<ScheduledTransactionInput>;

export type MonthCategoryInput = {
  budgeted: number;
};

export type PayeeInput = {
  name: string;
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
  private readonly readCacheEnabled: boolean;
  private readonly readCacheTtlMs: number;
  private readonly readCache = new Map<string, CacheEntry>();
  private readonly inFlightReads = new Map<string, Promise<unknown>>();
  private cacheGeneration = 0;

  constructor(config: YnabClientConfig) {
    this.baseUrl = config.baseUrl;
    this.accessToken = config.accessToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.readCacheTtlMs = config.cache?.ttlMs ?? DEFAULT_READ_CACHE_TTL_MS;
    this.readCacheEnabled = (config.cache?.enabled ?? true) && this.readCacheTtlMs > 0;
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

  listPayees(planId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/payees`);
  }

  createPayee(planId: string, payee: PayeeInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/payees`, undefined, { payee });
  }

  getPayee(planId: string, payeeId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}`);
  }

  updatePayee(planId: string, payeeId: string, payee: PayeeInput): Promise<unknown> {
    return this.request("PATCH", `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}`, undefined, { payee });
  }

  getMonth(planId: string, month: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}`);
  }

  listMonths(planId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/months`);
  }

  getMonthCategory(planId: string, month: string, categoryId: string): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/categories/${encodeURIComponent(categoryId)}`,
    );
  }

  updateMonthCategory(planId: string, month: string, categoryId: string, category: MonthCategoryInput): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/categories/${encodeURIComponent(categoryId)}`,
      undefined,
      { category },
    );
  }

  listTransactions(planId: string, sinceDate?: string): Promise<unknown> {
    const query = sinceDate ? { since_date: sinceDate } : undefined;
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/transactions`, query);
  }

  listCategoryTransactions(planId: string, categoryId: string): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}/transactions`,
    );
  }

  listAccountTransactions(planId: string, accountId: string): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/accounts/${encodeURIComponent(accountId)}/transactions`,
    );
  }

  listPayeeTransactions(planId: string, payeeId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}/transactions`);
  }

  listMonthTransactions(planId: string, month: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/transactions`);
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

  deleteTransaction(planId: string, transactionId: string): Promise<unknown> {
    return this.request("DELETE", `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`);
  }

  listScheduledTransactions(planId: string): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/scheduled_transactions`);
  }

  createScheduledTransaction(planId: string, scheduledTransaction: ScheduledTransactionInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/scheduled_transactions`, undefined, {
      scheduled_transaction: scheduledTransaction,
    });
  }

  getScheduledTransaction(planId: string, scheduledTransactionId: string): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions/${encodeURIComponent(scheduledTransactionId)}`,
    );
  }

  updateScheduledTransaction(
    planId: string,
    scheduledTransactionId: string,
    scheduledTransaction: UpdateScheduledTransactionInput,
  ): Promise<unknown> {
    return this.request(
      "PUT",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions/${encodeURIComponent(scheduledTransactionId)}`,
      undefined,
      { scheduled_transaction: scheduledTransaction },
    );
  }

  deleteScheduledTransaction(planId: string, scheduledTransactionId: string): Promise<unknown> {
    return this.request(
      "DELETE",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions/${encodeURIComponent(scheduledTransactionId)}`,
    );
  }

  private async request(
    method: YnabHttpMethod,
    path: string,
    query?: Record<string, string>,
    body?: unknown,
  ): Promise<unknown> {
    if (method === "GET" && this.readCacheEnabled) {
      return this.cachedGet(path, query ?? {});
    }

    const url = this.buildUrl(path, query ?? {});
    const responseBody = await this.fetchJson(method, url, body);
    if (method !== "GET") {
      this.invalidateReadCache();
    }
    return responseBody;
  }

  private async cachedGet(path: string, query: Record<string, string>): Promise<unknown> {
    const cacheKey = cacheKeyFor(path, query);
    const cached = this.readCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.value;
    }

    const inFlight = this.inFlightReads.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const generation = this.cacheGeneration;
    const request = this.fetchAndCacheGet(path, query, cached, cacheKey, generation);
    this.inFlightReads.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (this.inFlightReads.get(cacheKey) === request) {
        this.inFlightReads.delete(cacheKey);
      }
    }
  }

  private async fetchAndCacheGet(
    path: string,
    query: Record<string, string>,
    cached: CacheEntry | undefined,
    cacheKey: string,
    generation: number,
  ): Promise<unknown> {
    const deltaSupported = supportsDelta(path, query);
    const canUseDelta = deltaSupported && cached?.serverKnowledge !== undefined;
    const requestQuery = canUseDelta ? { ...query, last_knowledge_of_server: String(cached.serverKnowledge) } : query;
    const responseBody = await this.fetchJson("GET", this.buildUrl(path, requestQuery));
    const value = canUseDelta ? await this.resolveDeltaRefresh(path, query, cached.value, responseBody) : responseBody;

    if (this.cacheGeneration === generation) {
      this.readCache.set(cacheKey, {
        value,
        expiresAtMs: Date.now() + this.readCacheTtlMs,
        serverKnowledge: serverKnowledgeOf(value),
      });
    }
    return value;
  }

  private invalidateReadCache(): void {
    this.cacheGeneration += 1;
    this.readCache.clear();
    this.inFlightReads.clear();
  }

  private async resolveDeltaRefresh(
    path: string,
    query: Record<string, string>,
    cachedValue: unknown,
    deltaValue: unknown,
  ): Promise<unknown> {
    if (hasDeltaChanges(deltaValue)) {
      return this.fetchJson("GET", this.buildUrl(path, query));
    }
    return withServerKnowledge(cachedValue, serverKnowledgeOf(deltaValue));
  }

  private buildUrl(path: string, query: Record<string, string>): URL {
    const url = new URL(path.replace(/^\//, ""), appendSlash(this.baseUrl));
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }
    return url;
  }

  private async fetchJson(method: YnabHttpMethod, url: URL, body?: unknown): Promise<unknown> {
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

function supportsDelta(path: string, query: Record<string, string>): boolean {
  return Object.keys(query).length === 0 && DELTA_SUPPORTED_GET_PATHS.some((pattern) => pattern.test(path));
}

function cacheKeyFor(path: string, query: Record<string, string>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query).sort(([left], [right]) => left.localeCompare(right))) {
    searchParams.set(key, value);
  }
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function serverKnowledgeOf(value: unknown): number | undefined {
  if (!isRecord(value) || !isRecord(value.data)) {
    return undefined;
  }
  const serverKnowledge = value.data.server_knowledge;
  return typeof serverKnowledge === "number" ? serverKnowledge : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDeltaChanges(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.data)) {
    return true;
  }
  return Object.entries(value.data).some(([key, entry]) => key !== "server_knowledge" && hasContent(entry));
}

function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return value !== null && value !== undefined;
}

function withServerKnowledge(value: unknown, serverKnowledge: number | undefined): unknown {
  if (serverKnowledge === undefined || !isRecord(value) || !isRecord(value.data)) {
    return value;
  }
  return { ...value, data: { ...value.data, server_knowledge: serverKnowledge } };
}

function appendSlash(url: URL): URL {
  const copy = new URL(url.href);
  if (!copy.pathname.endsWith("/")) {
    copy.pathname = `${copy.pathname}/`;
  }
  return copy;
}

function toYnabMonthDate(month: string): string {
  return `${month}-01`;
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
