export type SupplyRequestCorrectionErrorCode =
  | "INVALID_INPUT"
  | "REQUEST_NOT_FOUND"
  | "CURRENT_VERSION_INVALID"
  | "STALE_VERSION"
  | "EQUIPMENT_NOT_FOUND"
  | "EQUIPMENT_INACTIVE"
  | "SUPERVISOR_NOT_FOUND"
  | "SUPERVISOR_INACTIVE"
  | "SUPPLY_ITEM_NOT_FOUND"
  | "SUPPLY_ITEM_INACTIVE"
  | "DUPLICATE_ITEM"
  | "EQUIPMENT_REPLACEMENT_REQUIRED"
  | "INVALID_STATUS_FACTS"
  | "RETRY_EXHAUSTED"
  | "UNEXPECTED_PERSISTENCE";

export class SupplyRequestCorrectionError extends Error {
  readonly name = "SupplyRequestCorrectionError";

  constructor(
    public readonly code: SupplyRequestCorrectionErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export function unexpectedSupplyRequestCorrectionError() {
  return new SupplyRequestCorrectionError(
    "UNEXPECTED_PERSISTENCE",
    "The Supply Request could not be corrected in NAM. Try again.",
  );
}
