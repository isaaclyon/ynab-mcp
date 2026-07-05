import {
  toYnabMonthDate,
  type AccountId,
  type CategoryGroupId,
  type CategoryId,
  type IsoDate,
  type Month,
  type PayeeId,
  type PlanId,
  type ScheduledTransactionId,
  type TransactionId,
} from "../domain/ynabValues.js";
import type {
  CategoryGroupInput,
  CategoryInput,
  CreateCategoryInput,
  CreateTransactionInput,
  MonthCategoryInput,
  PayeeInput,
  ScheduledTransactionInput,
  UpdateScheduledTransactionInput,
  UpdateTransactionInput,
} from "../domain/ynabCommands.js";

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

export class YnabApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly retryAfterSeconds?: number,
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

  listAccounts(planId: PlanId): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/accounts`);
  }

  listCategories(planId: PlanId): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/categories`);
  }

  getCategory(planId: PlanId, categoryId: CategoryId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}`,
    );
  }

  createCategory(planId: PlanId, category: CreateCategoryInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/categories`, undefined, {
      category,
    });
  }

  updateCategory(
    planId: PlanId,
    categoryId: CategoryId,
    category: CategoryInput,
  ): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}`,
      undefined,
      {
        category,
      },
    );
  }

  createCategoryGroup(planId: PlanId, categoryGroup: CategoryGroupInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/category_groups`, undefined, {
      category_group: categoryGroup,
    });
  }

  updateCategoryGroup(
    planId: PlanId,
    categoryGroupId: CategoryGroupId,
    categoryGroup: CategoryGroupInput,
  ): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/category_groups/${encodeURIComponent(categoryGroupId)}`,
      undefined,
      { category_group: categoryGroup },
    );
  }

  listPayees(planId: PlanId): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/payees`);
  }

  createPayee(planId: PlanId, payee: PayeeInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/payees`, undefined, {
      payee,
    });
  }

  getPayee(planId: PlanId, payeeId: PayeeId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}`,
    );
  }

  updatePayee(planId: PlanId, payeeId: PayeeId, payee: PayeeInput): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}`,
      undefined,
      { payee },
    );
  }

  getMonth(planId: PlanId, month: Month): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}`,
    );
  }

  listMonths(planId: PlanId): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/months`);
  }

  getMonthCategory(planId: PlanId, month: Month, categoryId: CategoryId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/categories/${encodeURIComponent(categoryId)}`,
    );
  }

  updateMonthCategory(
    planId: PlanId,
    month: Month,
    categoryId: CategoryId,
    category: MonthCategoryInput,
  ): Promise<unknown> {
    return this.request(
      "PATCH",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/categories/${encodeURIComponent(categoryId)}`,
      undefined,
      { category },
    );
  }

  listTransactions(planId: PlanId, sinceDate?: IsoDate): Promise<unknown> {
    const query = sinceDate ? { since_date: sinceDate } : undefined;
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/transactions`, query);
  }

  listCategoryTransactions(planId: PlanId, categoryId: CategoryId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/categories/${encodeURIComponent(categoryId)}/transactions`,
    );
  }

  listAccountTransactions(planId: PlanId, accountId: AccountId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/accounts/${encodeURIComponent(accountId)}/transactions`,
    );
  }

  listPayeeTransactions(planId: PlanId, payeeId: PayeeId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/payees/${encodeURIComponent(payeeId)}/transactions`,
    );
  }

  listMonthTransactions(planId: PlanId, month: Month): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/months/${encodeURIComponent(toYnabMonthDate(month))}/transactions`,
    );
  }

  getTransaction(planId: PlanId, transactionId: TransactionId): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`,
    );
  }

  createTransaction(planId: PlanId, transaction: CreateTransactionInput): Promise<unknown> {
    return this.request("POST", `/plans/${encodeURIComponent(planId)}/transactions`, undefined, {
      transaction,
    });
  }

  updateTransaction(
    planId: PlanId,
    transactionId: TransactionId,
    transaction: UpdateTransactionInput,
  ): Promise<unknown> {
    return this.request(
      "PUT",
      `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`,
      undefined,
      {
        transaction,
      },
    );
  }

  deleteTransaction(planId: PlanId, transactionId: TransactionId): Promise<unknown> {
    return this.request(
      "DELETE",
      `/plans/${encodeURIComponent(planId)}/transactions/${encodeURIComponent(transactionId)}`,
    );
  }

  listScheduledTransactions(planId: PlanId): Promise<unknown> {
    return this.request("GET", `/plans/${encodeURIComponent(planId)}/scheduled_transactions`);
  }

  createScheduledTransaction(
    planId: PlanId,
    scheduledTransaction: ScheduledTransactionInput,
  ): Promise<unknown> {
    return this.request(
      "POST",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions`,
      undefined,
      {
        scheduled_transaction: scheduledTransaction,
      },
    );
  }

  getScheduledTransaction(
    planId: PlanId,
    scheduledTransactionId: ScheduledTransactionId,
  ): Promise<unknown> {
    return this.request(
      "GET",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions/${encodeURIComponent(scheduledTransactionId)}`,
    );
  }

  updateScheduledTransaction(
    planId: PlanId,
    scheduledTransactionId: ScheduledTransactionId,
    scheduledTransaction: UpdateScheduledTransactionInput,
  ): Promise<unknown> {
    return this.request(
      "PUT",
      `/plans/${encodeURIComponent(planId)}/scheduled_transactions/${encodeURIComponent(scheduledTransactionId)}`,
      undefined,
      { scheduled_transaction: scheduledTransaction },
    );
  }

  deleteScheduledTransaction(
    planId: PlanId,
    scheduledTransactionId: ScheduledTransactionId,
  ): Promise<unknown> {
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
    const requestQuery = canUseDelta
      ? { ...query, last_knowledge_of_server: String(cached.serverKnowledge) }
      : query;
    const responseBody = await this.fetchJson("GET", this.buildUrl(path, requestQuery));
    const value = canUseDelta
      ? await this.resolveDeltaRefresh(path, query, cached.value, responseBody)
      : responseBody;

    if (this.cacheGeneration === generation) {
      const serverKnowledge = serverKnowledgeOf(value);
      this.readCache.set(cacheKey, {
        value,
        expiresAtMs: Date.now() + this.readCacheTtlMs,
        ...(serverKnowledge === undefined ? {} : { serverKnowledge }),
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
    for (const [key, value] of Object.entries(query)) {
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
      throw new YnabApiError(
        `YNAB API request failed with status ${response.status}`,
        response.status,
        responseBody,
        retryAfterSeconds(response.headers.get("retry-after")),
      );
    }
    return responseBody;
  }
}

function supportsDelta(path: string, query: Record<string, string>): boolean {
  return (
    Object.keys(query).length === 0 &&
    DELTA_SUPPORTED_GET_PATHS.some((pattern) => pattern.test(path))
  );
}

function cacheKeyFor(path: string, query: Record<string, string>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    searchParams.set(key, value);
  }
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function serverKnowledgeOf(value: unknown): number | undefined {
  if (!isRecord(value) || !isRecord(value["data"])) {
    return undefined;
  }
  const serverKnowledge = value["data"]["server_knowledge"];
  return typeof serverKnowledge === "number" ? serverKnowledge : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDeltaChanges(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["data"])) {
    return true;
  }
  return Object.entries(value["data"]).some(
    ([key, entry]) => key !== "server_knowledge" && hasContent(entry),
  );
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
  if (serverKnowledge === undefined || !isRecord(value) || !isRecord(value["data"])) {
    return value;
  }
  return { ...value, data: { ...value["data"], server_knowledge: serverKnowledge } };
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

function retryAfterSeconds(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }
  const dateMs = Date.parse(value);
  if (!Number.isFinite(dateMs)) {
    return undefined;
  }
  return Math.max(0, Math.ceil((dateMs - Date.now()) / 1_000));
}
