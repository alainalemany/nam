import type { SupplyRequestStatus } from "@prisma/client";

export type SupplyRequestHistoryRow = Readonly<{
  supplyRequestId: string;
  namReference: string;
  versionNumber: number;
  status: SupplyRequestStatus;
  statusLabel: string;
  operationalWorkDate: string;
  submittedLocalDate: string;
  submittedLocalTime: string;
  equipmentLabel: string;
  equipmentNumber: string | null;
  mineName: string;
  cityLabel: string;
  supervisorName: string;
  itemCount: number;
  detailHref: string;
}>;

export type SupplyRequestHistoryFilterOption = Readonly<{
  id: string;
  label: string;
  active: boolean;
}>;

export type SupplyRequestHistoryPageData = Readonly<{
  status: "ready";
  rows: readonly SupplyRequestHistoryRow[];
  equipmentOptions: readonly SupplyRequestHistoryFilterOption[];
  supervisorOptions: readonly SupplyRequestHistoryFilterOption[];
  totalCount: number;
  matchingCount: number;
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}>;

export type SupplyRequestHistoryPageResult =
  | SupplyRequestHistoryPageData
  | Readonly<{ status: "error"; message: string }>;
