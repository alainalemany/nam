export type SupplyRequestLifecycleErrorCode =
  | "INVALID_INPUT"
  | "REQUEST_NOT_FOUND"
  | "CURRENT_VERSION_INVALID"
  | "STALE_VERSION"
  | "INVALID_TRANSITION"
  | "FULFILLMENT_WORK_DATE_BEFORE_REQUEST"
  | "LIFECYCLE_TIME_BEFORE_SUBMISSION"
  | "RETRY_EXHAUSTED"
  | "UNEXPECTED_PERSISTENCE";

export class SupplyRequestLifecycleError extends Error {
  readonly name = "SupplyRequestLifecycleError";

  constructor(
    public readonly code: SupplyRequestLifecycleErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export function unexpectedSupplyRequestLifecycleError() {
  return new SupplyRequestLifecycleError(
    "UNEXPECTED_PERSISTENCE",
    "The Supply Request could not be updated in NAM. Try again.",
  );
}
