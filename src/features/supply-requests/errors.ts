export type SupplyRequestCreateErrorCode =
  | "INVALID_INPUT"
  | "EQUIPMENT_NOT_FOUND"
  | "EQUIPMENT_INACTIVE"
  | "SUPERVISOR_NOT_FOUND"
  | "SUPERVISOR_INACTIVE"
  | "SUPPLY_ITEM_NOT_FOUND"
  | "SUPPLY_ITEM_INACTIVE"
  | "DUPLICATE_ITEM_SELECTION"
  | "RETRY_EXHAUSTED"
  | "UNEXPECTED_PERSISTENCE";

export class SupplyRequestCreateError extends Error {
  readonly name = "SupplyRequestCreateError";

  constructor(
    public readonly code: SupplyRequestCreateErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export function unexpectedSupplyRequestPersistenceError() {
  return new SupplyRequestCreateError(
    "UNEXPECTED_PERSISTENCE",
    "The submitted request could not be recorded in NAM. Try again.",
  );
}
