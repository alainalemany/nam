import { prisma } from "@/lib/prisma";

import { getSupplyRequestDayViewItemsWithClient } from "./day-view-data-internal";
import { supplyRequestHistoryPageHref } from "./history-filters";
import type { SupplyRequestDayViewItem } from "./day-view-types";
import { SupplyRequestDayViewError } from "./day-view-types";
import { isCanonicalSupplyRequestDate } from "./validation";

export async function getSupplyRequestDayViewItems(
  selectedDate: string,
): Promise<readonly SupplyRequestDayViewItem[]> {
  try {
    return await getSupplyRequestDayViewItemsWithClient(prisma, selectedDate);
  } catch (error) {
    if (error instanceof SupplyRequestDayViewError) throw error;
    throw new SupplyRequestDayViewError(
      "QUERY_UNAVAILABLE",
      "Supply Request Day View data is temporarily unavailable.",
    );
  }
}

export function supplyRequestDayViewHistoryHref(selectedDate: string) {
  if (!isCanonicalSupplyRequestDate(selectedDate)) {
    throw new SupplyRequestDayViewError(
      "INVALID_DATE",
      "Supply Request Day View requires a valid operational date.",
    );
  }
  return supplyRequestHistoryPageHref(
    { dateFrom: selectedDate, dateTo: selectedDate, page: 1 },
    1,
  );
}
