import type { Prisma, PrismaClient } from "@prisma/client";

import {
  currentVersionRowSelect,
  mapRow,
} from "./history-data-internal";
import type { SupplyRequestDayViewItem } from "./day-view-types";
import { SupplyRequestDayViewError } from "./day-view-types";
import { isCanonicalSupplyRequestDate } from "./validation";

export const dayViewCurrentVersionSelect = currentVersionRowSelect;

export const supplyRequestDayViewOrderBy = [
  { currentVersion: { submittedLocalDate: "asc" as const } },
  { currentVersion: { submittedLocalTime: "asc" as const } },
  { namReference: "asc" as const },
  { id: "asc" as const },
] satisfies Prisma.SupplyRequestOrderByWithRelationInput[];

export function parseSupplyRequestDayViewDate(value: unknown) {
  if (typeof value !== "string" || !isCanonicalSupplyRequestDate(value)) {
    throw new SupplyRequestDayViewError(
      "INVALID_DATE",
      "Supply Request Day View requires a valid operational date.",
    );
  }
  return value;
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export const supplyRequestDayViewSelect = {
  id: true,
  namReference: true,
  currentVersionId: true,
  currentVersion: { select: dayViewCurrentVersionSelect },
} satisfies Prisma.SupplyRequestSelect;

export type SupplyRequestDayViewRecord = Prisma.SupplyRequestGetPayload<{
  select: typeof supplyRequestDayViewSelect;
}>;

export function mapSupplyRequestDayViewRecord(
  record: SupplyRequestDayViewRecord,
  selectedDate: string,
): SupplyRequestDayViewItem {
  let row;
  try {
    row = mapRow(record);
  } catch {
    throw new SupplyRequestDayViewError(
      "INVALID_CURRENT_STATE",
      "Supply Request Day View cannot display an invalid current request.",
    );
  }
  if (row.operationalWorkDate !== selectedDate) {
    throw new SupplyRequestDayViewError(
      "INVALID_CURRENT_STATE",
      "Supply Request Day View cannot display an invalid current request.",
    );
  }
  return {
    supplyRequestId: row.supplyRequestId,
    namReference: row.namReference,
    equipmentLabel: row.equipmentLabel,
    itemCount: row.itemCount,
    supervisorName: row.supervisorName,
    statusLabel: row.statusLabel,
    submittedLocalDate: row.submittedLocalDate,
    submittedLocalTime: row.submittedLocalTime,
    detailHref: row.detailHref,
  };
}

export async function getSupplyRequestDayViewItemsWithClient(
  client: Pick<PrismaClient, "supplyRequest">,
  selectedDateInput: unknown,
): Promise<readonly SupplyRequestDayViewItem[]> {
  const selectedDate = parseSupplyRequestDayViewDate(selectedDateInput);
  const records = await client.supplyRequest.findMany({
    where: {
      currentVersion: {
        is: { operationalWorkDate: dateOnly(selectedDate) },
      },
    },
    select: supplyRequestDayViewSelect,
    orderBy: supplyRequestDayViewOrderBy,
  });

  return records.map((record) =>
    mapSupplyRequestDayViewRecord(record, selectedDate),
  );
}
