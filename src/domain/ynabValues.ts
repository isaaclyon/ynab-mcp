import { z } from "zod";

type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type PlanId = Brand<string, "PlanId">;
export type AccountId = Brand<string, "AccountId">;
export type CategoryId = Brand<string, "CategoryId">;
export type CategoryGroupId = Brand<string, "CategoryGroupId">;
export type PayeeId = Brand<string, "PayeeId">;
export type TransactionId = Brand<string, "TransactionId">;
export type ScheduledTransactionId = Brand<string, "ScheduledTransactionId">;
export type Month = Brand<string, "Month">;
export type IsoDate = Brand<string, "IsoDate">;
export type Milliunits = Brand<number, "Milliunits">;

const nonEmptyTrimmed = z.string().trim().min(1);
const nonEmptyUntrimmed = z.string().min(1);
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const planIdSchema = nonEmptyTrimmed.transform((value) => value as PlanId);
export const accountIdSchema = nonEmptyTrimmed.transform((value) => value as AccountId);
export const categoryIdSchema = nonEmptyTrimmed.transform((value) => value as CategoryId);
export const categoryGroupIdSchema = nonEmptyTrimmed.transform((value) => value as CategoryGroupId);
export const payeeIdSchema = nonEmptyTrimmed.transform((value) => value as PayeeId);
export const untrimmedPayeeIdSchema = nonEmptyUntrimmed.transform((value) => value as PayeeId);
export const transactionIdSchema = nonEmptyTrimmed.transform((value) => value as TransactionId);
export const scheduledTransactionIdSchema = nonEmptyTrimmed.transform(
  (value) => value as ScheduledTransactionId,
);
export const monthSchema = z
  .string()
  .trim()
  .regex(monthPattern)
  .transform((value) => value as Month);
export const isoDateSchema = z
  .string()
  .regex(isoDatePattern)
  .transform((value) => value as IsoDate);
export const milliunitsSchema = z
  .number()
  .int()
  .transform((value) => value as Milliunits);

export function toYnabMonthDate(month: Month): IsoDate {
  return `${month}-01` as IsoDate;
}
