export type SupplyRequestReferenceErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "DUPLICATE_ITEM_NUMBER"
  | "DUPLICATE_SUPERVISOR_EMAIL"
  | "UNEXPECTED_PERSISTENCE";

export class SupplyRequestReferenceError extends Error {
  readonly name = "SupplyRequestReferenceError";

  constructor(
    public readonly code: SupplyRequestReferenceErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export function unexpectedSupplyRequestReferenceError() {
  return new SupplyRequestReferenceError(
    "UNEXPECTED_PERSISTENCE",
    "The reference record could not be saved in NAM. Try again.",
  );
}
