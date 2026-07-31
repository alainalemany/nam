export type SupplyRequestDayViewItem = Readonly<{
  supplyRequestId: string;
  namReference: string;
  equipmentLabel: string;
  itemCount: number;
  supervisorName: string;
  statusLabel: string;
  submittedLocalDate: string;
  submittedLocalTime: string;
  detailHref: string;
}>;

export type SupplyRequestDayViewErrorCode =
  | "INVALID_DATE"
  | "INVALID_CURRENT_STATE"
  | "QUERY_UNAVAILABLE";

export class SupplyRequestDayViewError extends Error {
  constructor(
    readonly code: SupplyRequestDayViewErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SupplyRequestDayViewError";
  }
}
