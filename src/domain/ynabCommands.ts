import { z } from "zod";
import {
  accountIdSchema,
  categoryGroupIdSchema,
  categoryIdSchema,
  isoDateSchema,
  milliunitsSchema,
  monthSchema,
  payeeIdSchema,
  planIdSchema,
  scheduledTransactionIdSchema,
  transactionIdSchema,
  untrimmedPayeeIdSchema,
  type AccountId,
  type CategoryGroupId,
  type CategoryId,
  type IsoDate,
  type Milliunits,
  type Month,
  type PayeeId,
  type PlanId,
  type ScheduledTransactionId,
  type TransactionId,
} from "./ynabValues.js";

export type CategoryGroupInput = {
  name: string;
};

export type CategoryInput = {
  name?: string | null;
  note?: string | null;
  category_group_id?: CategoryGroupId;
  goal_target?: Milliunits | null;
  goal_target_date?: IsoDate | null;
  goal_needs_whole_amount?: boolean | null;
};

export type CreateCategoryInput = CategoryInput & { name: string; category_group_id: CategoryGroupId };

export type CreateTransactionInput = {
  account_id: AccountId;
  date: IsoDate;
  amount: Milliunits;
  payee_id?: PayeeId;
  payee_name?: string;
  category_id?: CategoryId | null;
  memo?: string | null;
  cleared?: TransactionCleared;
  approved?: boolean;
  flag_color?: TransactionFlagColor | null;
  import_id?: string;
};

export type UpdateTransactionInput = Partial<Omit<CreateTransactionInput, "import_id">>;

export type ScheduledTransactionInput = {
  account_id: AccountId;
  date: IsoDate;
  amount: Milliunits;
  frequency: ScheduledTransactionFrequency;
  payee_id?: PayeeId;
  payee_name?: string;
  category_id?: CategoryId | null;
  memo?: string | null;
  flag_color?: TransactionFlagColor | null;
};

export type UpdateScheduledTransactionInput = Partial<ScheduledTransactionInput>;

export type MonthCategoryInput = {
  budgeted: Milliunits;
};

export type PayeeInput = {
  name: string;
};

export type TransactionCleared = "cleared" | "uncleared" | "reconciled";
export type TransactionFlagColor = "red" | "orange" | "yellow" | "green" | "blue" | "purple";
export type ScheduledTransactionFrequency =
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

export type CreatePayeeCommand = { planId: PlanId; payee: PayeeInput };
export type UpdatePayeeCommand = { planId: PlanId; payeeId: PayeeId; payee: PayeeInput };
export type CreateCategoryGroupCommand = { planId: PlanId; categoryGroup: CategoryGroupInput };
export type UpdateCategoryGroupCommand = { planId: PlanId; categoryGroupId: CategoryGroupId; categoryGroup: CategoryGroupInput };
export type CreateCategoryCommand = { planId: PlanId; category: CreateCategoryInput };
export type UpdateCategoryCommand = { planId: PlanId; categoryId: CategoryId; category: CategoryInput };
export type UpdateMonthCategoryCommand = { planId: PlanId; month: Month; categoryId: CategoryId; category: MonthCategoryInput };
export type CreateTransactionCommand = { planId: PlanId; transaction: CreateTransactionInput };
export type UpdateTransactionCommand = { planId: PlanId; transactionId: TransactionId; transaction: UpdateTransactionInput };
export type DeleteTransactionCommand = { planId: PlanId; transactionId: TransactionId };
export type CreateScheduledTransactionCommand = { planId: PlanId; scheduledTransaction: ScheduledTransactionInput };
export type UpdateScheduledTransactionCommand = {
  planId: PlanId;
  scheduledTransactionId: ScheduledTransactionId;
  scheduledTransaction: UpdateScheduledTransactionInput;
};
export type DeleteScheduledTransactionCommand = { planId: PlanId; scheduledTransactionId: ScheduledTransactionId };

const categoryNameSchema = z.string().min(1).max(50);
const categoryGroupNameSchema = z.string().min(1).max(50);
const payeeNameSchema = z.string().trim().min(1).max(100);
const nullableMemoSchema = z.string().max(500).nullable().optional();
const nullableNoteSchema = z.string().max(500).nullable().optional();
const transactionClearedSchema = z.enum(["cleared", "uncleared", "reconciled"]);
const transactionFlagColorSchema = z.enum(["red", "orange", "yellow", "green", "blue", "purple"]);
const importIdSchema = z.string().min(1).max(36);
const scheduledTransactionFrequencySchema = z.enum([
  "never",
  "daily",
  "weekly",
  "everyOtherWeek",
  "twiceAMonth",
  "every4Weeks",
  "monthly",
  "everyOtherMonth",
  "every3Months",
  "every4Months",
  "twiceAYear",
  "yearly",
  "everyOtherYear",
]);

const createPayeeCommandSchema = z.object({ plan_id: planIdSchema, name: payeeNameSchema });
const updatePayeeCommandSchema = z.object({ plan_id: planIdSchema, payee_id: untrimmedPayeeIdSchema, name: payeeNameSchema });
const createCategoryGroupCommandSchema = z.object({ plan_id: planIdSchema, name: categoryGroupNameSchema });
const updateCategoryGroupCommandSchema = z.object({
  plan_id: planIdSchema,
  category_group_id: categoryGroupIdSchema,
  name: categoryGroupNameSchema,
});
const createCategoryCommandSchema = z.object({
  plan_id: planIdSchema,
  category_group_id: categoryGroupIdSchema,
  name: categoryNameSchema,
  note: nullableNoteSchema,
  goal_target: milliunitsSchema.nullable().optional(),
  goal_target_date: isoDateSchema.optional(),
  goal_needs_whole_amount: z.boolean().nullable().optional(),
});
const updateCategoryCommandSchema = z.object({
  plan_id: planIdSchema,
  category_id: categoryIdSchema,
  name: categoryNameSchema.optional(),
  note: nullableNoteSchema,
  category_group_id: categoryGroupIdSchema.optional(),
  goal_target: milliunitsSchema.nullable().optional(),
  goal_target_date: isoDateSchema.nullable().optional(),
  goal_needs_whole_amount: z.boolean().nullable().optional(),
});
const updateMonthCategoryCommandSchema = z.object({
  plan_id: planIdSchema,
  month: monthSchema,
  category_id: categoryIdSchema,
  budgeted: milliunitsSchema,
});

const createTransactionCommandSchema = z.object({
  plan_id: planIdSchema,
  account_id: accountIdSchema,
  date: isoDateSchema,
  amount: milliunitsSchema,
  payee_id: untrimmedPayeeIdSchema.optional(),
  payee_name: payeeNameSchema.optional(),
  category_id: categoryIdSchema.nullable().optional(),
  memo: nullableMemoSchema,
  cleared: transactionClearedSchema.optional(),
  approved: z.boolean().optional(),
  flag_color: transactionFlagColorSchema.nullable().optional(),
  import_id: importIdSchema.optional(),
});
const updateTransactionCommandSchema = z.object({
  plan_id: planIdSchema,
  transaction_id: transactionIdSchema,
  account_id: accountIdSchema.optional(),
  date: isoDateSchema.optional(),
  amount: milliunitsSchema.optional(),
  payee_id: untrimmedPayeeIdSchema.optional(),
  payee_name: payeeNameSchema.optional(),
  category_id: categoryIdSchema.nullable().optional(),
  memo: nullableMemoSchema,
  cleared: transactionClearedSchema.optional(),
  approved: z.boolean().optional(),
  flag_color: transactionFlagColorSchema.nullable().optional(),
});
const deleteTransactionCommandSchema = z.object({ plan_id: planIdSchema, transaction_id: transactionIdSchema });

const createScheduledTransactionCommandSchema = z.object({
  plan_id: planIdSchema,
  account_id: accountIdSchema,
  date: isoDateSchema,
  amount: milliunitsSchema,
  frequency: scheduledTransactionFrequencySchema,
  payee_id: untrimmedPayeeIdSchema.optional(),
  payee_name: payeeNameSchema.optional(),
  category_id: categoryIdSchema.nullable().optional(),
  memo: nullableMemoSchema,
  flag_color: transactionFlagColorSchema.nullable().optional(),
});
const updateScheduledTransactionCommandSchema = z.object({
  plan_id: planIdSchema,
  scheduled_transaction_id: scheduledTransactionIdSchema,
  account_id: accountIdSchema.optional(),
  date: isoDateSchema.optional(),
  amount: milliunitsSchema.optional(),
  frequency: scheduledTransactionFrequencySchema.optional(),
  payee_id: untrimmedPayeeIdSchema.optional(),
  payee_name: payeeNameSchema.optional(),
  category_id: categoryIdSchema.nullable().optional(),
  memo: nullableMemoSchema,
  flag_color: transactionFlagColorSchema.nullable().optional(),
});
const deleteScheduledTransactionCommandSchema = z.object({
  plan_id: planIdSchema,
  scheduled_transaction_id: scheduledTransactionIdSchema,
});

export function parseCreatePayeeCommand(value: unknown): CreatePayeeCommand {
  const parsed = createPayeeCommandSchema.parse(value);
  return { planId: parsed.plan_id, payee: { name: parsed.name } };
}

export function parseUpdatePayeeCommand(value: unknown): UpdatePayeeCommand {
  const parsed = updatePayeeCommandSchema.parse(value);
  return { planId: parsed.plan_id, payeeId: parsed.payee_id, payee: { name: parsed.name } };
}

export function parseCreateCategoryGroupCommand(value: unknown): CreateCategoryGroupCommand {
  const parsed = createCategoryGroupCommandSchema.parse(value);
  return { planId: parsed.plan_id, categoryGroup: { name: parsed.name } };
}

export function parseUpdateCategoryGroupCommand(value: unknown): UpdateCategoryGroupCommand {
  const parsed = updateCategoryGroupCommandSchema.parse(value);
  return { planId: parsed.plan_id, categoryGroupId: parsed.category_group_id, categoryGroup: { name: parsed.name } };
}

export function parseCreateCategoryCommand(value: unknown): CreateCategoryCommand {
  const parsed = createCategoryCommandSchema.parse(value);
  assertGoalFields(parsed.goal_needs_whole_amount, parsed.goal_target, parsed.goal_target_date);
  return {
    planId: parsed.plan_id,
    category: {
      category_group_id: parsed.category_group_id,
      name: parsed.name,
      ...compact({
        note: parsed.note,
        goal_target: parsed.goal_target,
        goal_target_date: parsed.goal_target_date,
        goal_needs_whole_amount: parsed.goal_needs_whole_amount,
      }),
    },
  };
}

export function parseUpdateCategoryCommand(value: unknown): UpdateCategoryCommand {
  const parsed = updateCategoryCommandSchema.parse(value);
  assertGoalFields(parsed.goal_needs_whole_amount, parsed.goal_target, parsed.goal_target_date);
  const category = compact({
    name: parsed.name,
    note: parsed.note,
    category_group_id: parsed.category_group_id,
    goal_target: parsed.goal_target,
    goal_target_date: parsed.goal_target_date,
    goal_needs_whole_amount: parsed.goal_needs_whole_amount,
  });
  assertNonEmptyUpdate(category, "At least one category field must be provided to update.");
  return { planId: parsed.plan_id, categoryId: parsed.category_id, category };
}

export function parseUpdateMonthCategoryCommand(value: unknown): UpdateMonthCategoryCommand {
  const parsed = updateMonthCategoryCommandSchema.parse(value);
  return { planId: parsed.plan_id, month: parsed.month, categoryId: parsed.category_id, category: { budgeted: parsed.budgeted } };
}

export function parseCreateTransactionCommand(value: unknown): CreateTransactionCommand {
  const parsed = createTransactionCommandSchema.parse(value);
  assertPayeeFields(parsed.payee_id, parsed.payee_name);
  return {
    planId: parsed.plan_id,
    transaction: {
      account_id: parsed.account_id,
      date: parsed.date,
      amount: parsed.amount,
      ...compact({
        payee_id: parsed.payee_id,
        payee_name: parsed.payee_name,
        category_id: parsed.category_id,
        memo: parsed.memo,
        cleared: parsed.cleared,
        approved: parsed.approved,
        flag_color: parsed.flag_color,
        import_id: parsed.import_id,
      }),
    },
  };
}

export function parseUpdateTransactionCommand(value: unknown): UpdateTransactionCommand {
  const parsed = updateTransactionCommandSchema.parse(value);
  assertPayeeFields(parsed.payee_id, parsed.payee_name);
  const transaction = compact({
    account_id: parsed.account_id,
    date: parsed.date,
    amount: parsed.amount,
    payee_id: parsed.payee_id,
    payee_name: parsed.payee_name,
    category_id: parsed.category_id,
    memo: parsed.memo,
    cleared: parsed.cleared,
    approved: parsed.approved,
    flag_color: parsed.flag_color,
  });
  assertNonEmptyUpdate(transaction, "At least one transaction field must be provided to update.");
  return { planId: parsed.plan_id, transactionId: parsed.transaction_id, transaction };
}

export function parseDeleteTransactionCommand(value: unknown): DeleteTransactionCommand {
  const parsed = deleteTransactionCommandSchema.parse(value);
  return { planId: parsed.plan_id, transactionId: parsed.transaction_id };
}

export function parseCreateScheduledTransactionCommand(value: unknown): CreateScheduledTransactionCommand {
  const parsed = createScheduledTransactionCommandSchema.parse(value);
  assertPayeeFields(parsed.payee_id, parsed.payee_name);
  return {
    planId: parsed.plan_id,
    scheduledTransaction: {
      account_id: parsed.account_id,
      date: parsed.date,
      amount: parsed.amount,
      frequency: parsed.frequency,
      ...compact({
        payee_id: parsed.payee_id,
        payee_name: parsed.payee_name,
        category_id: parsed.category_id,
        memo: parsed.memo,
        flag_color: parsed.flag_color,
      }),
    },
  };
}

export function parseUpdateScheduledTransactionCommand(value: unknown): UpdateScheduledTransactionCommand {
  const parsed = updateScheduledTransactionCommandSchema.parse(value);
  assertPayeeFields(parsed.payee_id, parsed.payee_name);
  const scheduledTransaction = compact({
    account_id: parsed.account_id,
    date: parsed.date,
    amount: parsed.amount,
    frequency: parsed.frequency,
    payee_id: parsed.payee_id,
    payee_name: parsed.payee_name,
    category_id: parsed.category_id,
    memo: parsed.memo,
    flag_color: parsed.flag_color,
  });
  assertNonEmptyUpdate(scheduledTransaction, "At least one scheduled transaction field must be provided to update.");
  return { planId: parsed.plan_id, scheduledTransactionId: parsed.scheduled_transaction_id, scheduledTransaction };
}

export function parseDeleteScheduledTransactionCommand(value: unknown): DeleteScheduledTransactionCommand {
  const parsed = deleteScheduledTransactionCommandSchema.parse(value);
  return { planId: parsed.plan_id, scheduledTransactionId: parsed.scheduled_transaction_id };
}

function assertPayeeFields(payeeIdValue: PayeeId | undefined, payeeNameValue: string | undefined): void {
  if (payeeIdValue && payeeNameValue) {
    throw new Error("Provide either payee_id or payee_name, not both.");
  }
}

function assertGoalFields(
  goalNeedsWholeAmount: boolean | null | undefined,
  goalTarget: Milliunits | null | undefined,
  goalTargetDate: IsoDate | null | undefined,
): void {
  if (goalNeedsWholeAmount !== undefined && goalTarget === undefined && goalTargetDate === undefined) {
    throw new Error("goal_needs_whole_amount requires goal_target or goal_target_date.");
  }
}

function assertNonEmptyUpdate(value: Record<string, unknown>, message: string): void {
  if (Object.keys(value).length === 0) {
    throw new Error(message);
  }
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
