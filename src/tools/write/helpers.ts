export function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export function validatePayeeFields(payeeIdValue: string | undefined, payeeNameValue: string | undefined): void {
  if (payeeIdValue && payeeNameValue) {
    throw new Error("Provide either payee_id or payee_name, not both.");
  }
}
