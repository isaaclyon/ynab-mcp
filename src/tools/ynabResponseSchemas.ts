import { z } from "zod";

export class YnabResponseShapeError extends Error {
  constructor(
    readonly label: string,
    readonly issuePaths: string[],
  ) {
    super(`Unexpected YNAB response shape for ${label}: ${issuePaths.join(", ")}`);
    this.name = "YnabResponseShapeError";
  }
}

export function parseYnabResponse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  throw new YnabResponseShapeError(
    label,
    result.error.issues.map((issue) => issue.path.join(".") || "<root>"),
  );
}

const id = z.string().min(1);
const text = z.string();
const nullableId = id.nullable();
const nullableText = z.string().nullable();
const milliunits = z.number().int();
const boolean = z.boolean();
const nullableBoolean = z.boolean().nullable();
const optionalText = text.optional();
const optionalNullableText = nullableText.optional();
const optionalBoolean = boolean.optional();
const optionalNullableBoolean = nullableBoolean.optional();
const optionalMilliunits = milliunits.optional();
const optionalNullableMilliunits = milliunits.nullable().optional();

const dataContainer = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z
    .object({
      data: z.object(shape).passthrough(),
    })
    .passthrough();

const planSchema = z
  .object({
    id,
    name: text,
    last_modified_on: text.optional(),
    currency_format: z.unknown().optional(),
  })
  .passthrough();

export const accountSchema = z
  .object({
    id,
    name: text,
    type: text,
    on_budget: boolean,
    closed: boolean,
    balance: milliunits,
    cleared_balance: milliunits,
    uncleared_balance: milliunits,
    deleted: boolean,
  })
  .passthrough();

export const categorySchema = z
  .object({
    id,
    category_group_id: id,
    category_group_name: optionalText,
    name: text,
    note: optionalNullableText,
    hidden: optionalBoolean,
    internal: optionalBoolean,
    original_category_group_id: nullableId.optional(),
    budgeted: milliunits,
    activity: milliunits,
    balance: milliunits,
    goal_type: z.string().nullable().optional(),
    goal_target: optionalNullableMilliunits,
    goal_target_date: optionalNullableText,
    goal_needs_whole_amount: optionalNullableBoolean,
    deleted: boolean,
  })
  .passthrough();

const categoryGroupSchema = z
  .object({
    id,
    name: text,
    hidden: optionalBoolean,
    internal: optionalBoolean,
    deleted: optionalBoolean,
  })
  .passthrough();

const categoryGroupWithCategoriesSchema = categoryGroupSchema.extend({
  categories: z.array(categorySchema),
});

const payeeSchema = z
  .object({
    id,
    name: text,
    transfer_account_id: nullableId,
    deleted: boolean,
  })
  .passthrough();

const monthSummarySchema = z
  .object({
    month: text,
    note: nullableText,
    income: milliunits,
    budgeted: milliunits,
    activity: milliunits,
    to_be_budgeted: milliunits,
    age_of_money: z.number().int().nullable(),
    deleted: boolean,
  })
  .passthrough();

const monthSchema = monthSummarySchema.extend({
  categories: z.array(categorySchema),
});

const strictSubtransactionSchema = z
  .object({
    id,
    transaction_id: id,
    amount: milliunits,
    memo: nullableText,
    payee_id: nullableId,
    payee_name: nullableText,
    category_id: nullableId,
    category_name: nullableText,
    transfer_account_id: nullableId,
    deleted: boolean,
  })
  .passthrough();

const looseSubtransactionSchema = strictSubtransactionSchema.partial({
  transaction_id: true,
  amount: true,
  memo: true,
  payee_id: true,
  payee_name: true,
  category_id: true,
  category_name: true,
  transfer_account_id: true,
  deleted: true,
});

export const transactionSchema = z
  .object({
    id,
    date: text,
    amount: milliunits,
    memo: optionalNullableText,
    cleared: optionalText,
    approved: optionalBoolean,
    flag_color: optionalNullableText,
    account_id: id,
    account_name: text,
    payee_id: nullableId.optional(),
    payee_name: nullableText.optional(),
    category_id: nullableId.optional(),
    category_name: nullableText.optional(),
    transfer_account_id: nullableId.optional(),
    deleted: boolean,
    subtransactions: z.array(looseSubtransactionSchema).optional(),
  })
  .passthrough();

export const transactionWriteSchema = transactionSchema.partial({
  date: true,
  amount: true,
  memo: true,
  cleared: true,
  approved: true,
  flag_color: true,
  account_id: true,
  account_name: true,
  payee_id: true,
  payee_name: true,
  category_id: true,
  category_name: true,
  transfer_account_id: true,
  deleted: true,
  subtransactions: true,
}).extend({ subtransactions: z.array(looseSubtransactionSchema).optional() });

export const scheduledTransactionSchema = z
  .object({
    id,
    date_first: optionalText,
    date_next: text,
    amount: milliunits,
    memo: optionalNullableText,
    flag_color: optionalNullableText,
    frequency: text,
    account_id: id,
    account_name: text,
    payee_id: nullableId.optional(),
    payee_name: nullableText.optional(),
    category_id: nullableId.optional(),
    category_name: nullableText.optional(),
    transfer_account_id: nullableId.optional(),
    deleted: boolean,
    subtransactions: z.array(looseSubtransactionSchema).optional(),
  })
  .passthrough();

export const scheduledTransactionWriteSchema = scheduledTransactionSchema.partial({
  date_first: true,
  date_next: true,
  amount: true,
  memo: true,
  flag_color: true,
  frequency: true,
  account_id: true,
  account_name: true,
  payee_id: true,
  payee_name: true,
  category_id: true,
  category_name: true,
  transfer_account_id: true,
  deleted: true,
  subtransactions: true,
}).extend({ subtransactions: z.array(looseSubtransactionSchema).optional() });

export const accountsContainerSchema = dataContainer({ accounts: z.array(z.unknown()) });
export const transactionsContainerSchema = dataContainer({ transactions: z.array(z.unknown()) });
export const scheduledTransactionsContainerSchema = dataContainer({ scheduled_transactions: z.array(z.unknown()) });

export const plansResponseSchema = dataContainer({ plans: z.array(planSchema) });
export const categoriesResponseSchema = dataContainer({ category_groups: z.array(categoryGroupWithCategoriesSchema) });
export const categoryResponseSchema = dataContainer({ category: categorySchema });
export const categoryGroupResponseSchema = dataContainer({ category_group: categoryGroupSchema });
export const payeesResponseSchema = dataContainer({ payees: z.array(payeeSchema) });
export const payeeResponseSchema = dataContainer({ payee: payeeSchema });
export const monthsResponseSchema = dataContainer({ months: z.array(monthSummarySchema) });
export const monthResponseSchema = dataContainer({ month: monthSchema });
export const monthCategoryResponseSchema = dataContainer({ category: categorySchema });
export const transactionResponseSchema = dataContainer({ transaction: transactionSchema });
export const transactionWriteResponseSchema = dataContainer({ transaction: transactionWriteSchema });
export const scheduledTransactionResponseSchema = dataContainer({ scheduled_transaction: scheduledTransactionSchema });
export const scheduledTransactionWriteResponseSchema = dataContainer({ scheduled_transaction: scheduledTransactionWriteSchema });
