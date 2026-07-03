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

export function shapeCategory(response: unknown): unknown {
  const category = getRecord(response, ["data", "category"]);
  return category ? { category: shapeCategoryRecord(category) } : response;
}

export function shapeCategoryGroup(response: unknown): unknown {
  const group = getRecord(response, ["data", "category_group"]);
  return group ? { category_group: shapeCategoryGroupRecord(group) } : response;
}

export function shapeCategories(response: unknown): unknown {
  const groups = getArray(response, ["data", "category_groups"]);
  return {
    category_groups: groups.map((group) => ({
      ...shapeCategoryGroupRecord(group),
      categories: getArray(group, ["categories"]).map(shapeCategoryRecord),
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

function shapeCategoryRecord(category: JsonRecord): JsonRecord {
  return pick(category, [
    "id",
    "category_group_id",
    "category_group_name",
    "name",
    "note",
    "hidden",
    "internal",
    "original_category_group_id",
    "budgeted",
    "activity",
    "balance",
    "goal_type",
    "goal_target",
    "goal_target_date",
    "goal_needs_whole_amount",
    "deleted",
  ]);
}

function shapeCategoryGroupRecord(group: JsonRecord): JsonRecord {
  return pick(group, ["id", "name", "hidden", "internal", "deleted"]);
}

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
