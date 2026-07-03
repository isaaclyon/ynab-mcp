type JsonRecord = Record<string, unknown>;

export function shapePlans(response: unknown): unknown {
  const plans = getArray(response, ["data", "plans"]);
  return {
    plans: plans.map((plan) => pick(plan, ["id", "name", "last_modified_on", "currency_format"])),
  };
}

export function shapeAccounts(response: unknown, includeClosed: boolean): unknown {
  const accounts = getArray(response, ["data", "accounts"])
    .filter((account) => includeClosed || account.closed !== true)
    .map((account) => pick(account, ["id", "name", "type", "on_budget", "closed", "balance", "cleared_balance", "uncleared_balance", "deleted"]));
  return { accounts };
}

export function shapeCategories(response: unknown): unknown {
  const groups = getArray(response, ["data", "category_groups"]);
  return {
    category_groups: groups.map((group) => ({
      ...pick(group, ["id", "name", "hidden", "deleted"]),
      categories: getArray(group, ["categories"]).map((category) =>
        pick(category, ["id", "name", "hidden", "original_category_group_id", "budgeted", "activity", "balance", "deleted"]),
      ),
    })),
  };
}

export function shapeMonth(response: unknown): unknown {
  const month = getRecord(response, ["data", "month"]);
  if (!month) {
    return response;
  }
  return {
    month: {
      ...pick(month, ["month", "note", "income", "budgeted", "activity", "to_be_budgeted", "age_of_money"]),
      categories: getArray(month, ["categories"]).map((category) =>
        pick(category, ["id", "name", "category_group_id", "budgeted", "activity", "balance", "hidden", "deleted"]),
      ),
    },
  };
}

export function shapeTransactions(response: unknown, filters: TransactionFilters): unknown {
  const transactions = getArray(response, ["data", "transactions"])
    .filter((transaction) => matchesFilters(transaction, filters))
    .slice(0, filters.limit)
    .map(shapeTransactionRecord);
  return { transactions };
}

export function shapeTransaction(response: unknown): unknown {
  const transaction = getRecord(response, ["data", "transaction"]);
  return transaction ? { transaction: shapeTransactionRecord(transaction) } : response;
}

export type TransactionFilters = {
  limit: number;
  query?: string;
  accountId?: string;
  categoryId?: string;
};

function shapeTransactionRecord(transaction: JsonRecord): JsonRecord {
  return pick(transaction, [
    "id",
    "date",
    "amount",
    "memo",
    "cleared",
    "approved",
    "flag_color",
    "account_id",
    "account_name",
    "payee_id",
    "payee_name",
    "category_id",
    "category_name",
    "transfer_account_id",
    "deleted",
  ]);
}

function matchesFilters(transaction: JsonRecord, filters: TransactionFilters): boolean {
  if (filters.accountId && transaction.account_id !== filters.accountId) {
    return false;
  }
  if (filters.categoryId && transaction.category_id !== filters.categoryId) {
    return false;
  }
  if (!filters.query) {
    return true;
  }
  const haystack = [transaction.memo, transaction.payee_name, transaction.category_name, transaction.account_name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(filters.query.toLowerCase());
}

function getArray(value: unknown, path: string[]): JsonRecord[] {
  const target = getPath(value, path);
  return Array.isArray(target) ? target.filter(isRecord) : [];
}

function getRecord(value: unknown, path: string[]): JsonRecord | undefined {
  const target = getPath(value, path);
  return isRecord(target) ? target : undefined;
}

function getPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function pick(record: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter((key) => key in record).map((key) => [key, record[key]]));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
