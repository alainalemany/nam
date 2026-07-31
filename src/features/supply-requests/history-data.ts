import { prisma } from "@/lib/prisma";

import type { SupplyRequestHistoryFilters } from "./history-filters";
import { getSupplyRequestHistoryPageWithClient } from "./history-data-internal";
import type { SupplyRequestHistoryPageResult } from "./history-types";

export async function getSupplyRequestHistoryPage(
  filters: SupplyRequestHistoryFilters,
): Promise<SupplyRequestHistoryPageResult> {
  try {
    return await getSupplyRequestHistoryPageWithClient(prisma, filters);
  } catch {
    return {
      status: "error",
      message:
        "Supply Request history is temporarily unavailable. Try loading this page again.",
    };
  }
}
