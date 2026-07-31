export type SupplyRequestDailyLogLinkErrorCode =
  | "INVALID_INPUT"
  | "REQUEST_NOT_FOUND"
  | "CURRENT_VERSION_INVALID"
  | "INVALID_ROLE"
  | "STALE_LINK_STATE"
  | "FULFILLMENT_UNAVAILABLE"
  | "ACTIVITY_NOT_FOUND"
  | "ACTIVITY_TYPE_MISMATCH"
  | "ACTIVITY_TITLE_MISMATCH"
  | "ACTIVITY_DATE_MISMATCH"
  | "DAILY_LOG_DATE_MISMATCH"
  | "EQUIPMENT_MISMATCH"
  | "ACTIVITY_ALREADY_LINKED"
  | "LINK_NOT_FOUND"
  | "RETRY_EXHAUSTED"
  | "UNEXPECTED_PERSISTENCE";

export class SupplyRequestDailyLogLinkError extends Error {
  readonly name = "SupplyRequestDailyLogLinkError";

  constructor(
    public readonly code: SupplyRequestDailyLogLinkErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export class SupplyRequestDailyLogLinkQueryError extends Error {
  readonly name = "SupplyRequestDailyLogLinkQueryError";

  constructor(
    public readonly code: "CURRENT_VERSION_INVALID" | "LINK_INTEGRITY_INVALID",
    message = "Daily Log link information is temporarily unavailable.",
  ) {
    super(message);
  }
}

export function unexpectedSupplyRequestDailyLogLinkError() {
  return new SupplyRequestDailyLogLinkError(
    "UNEXPECTED_PERSISTENCE",
    "The Daily Log link could not be updated in NAM. Reload and try again.",
  );
}
