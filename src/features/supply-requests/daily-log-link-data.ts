import { prisma } from "@/lib/prisma";

import { SupplyRequestDailyLogLinkQueryError } from "./daily-log-link-errors";
import { getSupplyRequestDailyLogLinkContextWithClient } from "./daily-log-link-data-internal";
import type { SupplyRequestDailyLogRoleValue } from "./daily-log-link-types";

export type SupplyRequestDailyLogLinkContextResult =
  | Readonly<{ status: "ready"; context: NonNullable<Awaited<ReturnType<typeof getSupplyRequestDailyLogLinkContextWithClient>>> }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{ status: "error"; message: string }>;

export async function getSupplyRequestDailyLogLinkContext(
  id: unknown,
  role: SupplyRequestDailyLogRoleValue,
): Promise<SupplyRequestDailyLogLinkContextResult> {
  try {
    const context = await getSupplyRequestDailyLogLinkContextWithClient(
      prisma,
      id,
      role,
    );
    return context ? { status: "ready", context } : { status: "not-found" };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof SupplyRequestDailyLogLinkQueryError
          ? error.message
          : "Daily Log link information is temporarily unavailable. Reload and try again.",
    };
  }
}
