import { describe, expect, it, vi } from "vitest";

import { SupplyRequestDailyLogLinkError } from "@/features/supply-requests/daily-log-link-errors";
import {
  isRetryableSupplyRequestDailyLogLinkError,
  runSupplyRequestDailyLogLinkWithRetry,
} from "@/features/supply-requests/daily-log-link-retry";
import {
  compatibilityMessage,
  parseRemoveSupplyRequestDailyLogLinkInput,
  parseSetSupplyRequestDailyLogLinkInput,
  supplyRequestDailyLogCanonicalTitle,
  validateSupplyRequestDailyLogCompatibility,
} from "@/features/supply-requests/daily-log-link-validation";

const aggregate = {
  namReference: "SR-2026-0001",
  status: "FULFILLED" as const,
  operationalWorkDate: "2026-07-30",
  fulfillmentOperationalWorkDate: "2026-07-31",
  equipmentId: "equipment-1",
  equipmentDisplayNameSnapshot: "Dragline 101",
  equipmentNumberSnapshot: "101",
};

describe("Supply Request Daily Log link validation", () => {
  it("strictly parses set and removal inputs", () => {
    expect(
      parseSetSupplyRequestDailyLogLinkInput({
        supplyRequestId: " request-1 ",
        role: "SUBMISSION",
        dailyLogActivityId: " activity-1 ",
      }),
    ).toEqual({
      supplyRequestId: "request-1",
      role: "SUBMISSION",
      dailyLogActivityId: "activity-1",
    });
    expect(
      parseRemoveSupplyRequestDailyLogLinkInput({
        supplyRequestId: "request-1",
        role: "FULFILLMENT",
        expectedDailyLogActivityId: "activity-2",
      }),
    ).toMatchObject({ role: "FULFILLMENT" });
  });

  it("rejects unknown roles, caller-derived facts, unknown fields, and bounded IDs", () => {
    for (const input of [
      { supplyRequestId: "", role: "SUBMISSION", dailyLogActivityId: "a" },
      { supplyRequestId: "r", role: "CREATED", dailyLogActivityId: "a" },
      { supplyRequestId: "r", role: "SUBMISSION", dailyLogActivityId: "x".repeat(101) },
      { supplyRequestId: "r", role: "SUBMISSION", dailyLogActivityId: "a", title: "caller" },
      { supplyRequestId: "r", role: "SUBMISSION", dailyLogActivityId: "a", equipmentId: "caller" },
      { supplyRequestId: "r", role: "SUBMISSION", dailyLogActivityId: "a", status: "REQUESTED" },
      { supplyRequestId: "r", role: "SUBMISSION", dailyLogActivityId: "a", linkId: "caller" },
    ]) {
      expect(() => parseSetSupplyRequestDailyLogLinkInput(input)).toThrow(
        SupplyRequestDailyLogLinkError,
      );
    }
  });

  it("derives exact canonical titles only from immutable request facts", () => {
    expect(supplyRequestDailyLogCanonicalTitle("SUBMISSION", aggregate)).toBe(
      "Submitted supply request SR-2026-0001 for Dragline 101 · 101.",
    );
    expect(
      supplyRequestDailyLogCanonicalTitle("SUBMISSION", {
        ...aggregate,
        equipmentDisplayNameSnapshot: "101",
      }),
    ).toBe("Submitted supply request SR-2026-0001 for 101.");
    expect(supplyRequestDailyLogCanonicalTitle("FULFILLMENT", aggregate)).toBe(
      "Received all supplies associated with SR-2026-0001.",
    );
  });

  it("validates role dates, type, exact title, log date, and Equipment", () => {
    const activity = {
      activityType: "SUPPLY_REQUEST",
      title: supplyRequestDailyLogCanonicalTitle("SUBMISSION", aggregate),
      activityDate: "2026-07-30",
      dailyLogDate: "2026-07-30",
      equipmentId: "equipment-1",
    };
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, activity),
    ).toBeNull();
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, {
        ...activity,
        equipmentId: null,
      }),
    ).toBeNull();
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, {
        ...activity,
        title: `${activity.title} `,
      }),
    ).toBe("ACTIVITY_TITLE_MISMATCH");
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, {
        ...activity,
        activityDate: "2026-07-31",
      }),
    ).toBe("ACTIVITY_DATE_MISMATCH");
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, {
        ...activity,
        dailyLogDate: "2026-07-31",
      }),
    ).toBe("DAILY_LOG_DATE_MISMATCH");
    expect(
      validateSupplyRequestDailyLogCompatibility("SUBMISSION", aggregate, {
        ...activity,
        equipmentId: "equipment-2",
      }),
    ).toBe("EQUIPMENT_MISMATCH");
  });

  it("uses resulting Fulfilled status rather than change kind and supports SetNull", () => {
    const title = supplyRequestDailyLogCanonicalTitle("FULFILLMENT", aggregate);
    const activity = {
      activityType: "SUPPLY_REQUEST",
      title,
      activityDate: "2026-07-31",
      dailyLogDate: "2026-07-31",
      equipmentId: null,
    };
    expect(
      validateSupplyRequestDailyLogCompatibility("FULFILLMENT", aggregate, activity),
    ).toBeNull();
    expect(
      validateSupplyRequestDailyLogCompatibility(
        "FULFILLMENT",
        { ...aggregate, status: "REQUESTED", fulfillmentOperationalWorkDate: null },
        activity,
      ),
    ).toBe("FULFILLMENT_UNAVAILABLE");
    expect(
      validateSupplyRequestDailyLogCompatibility(
        "SUBMISSION",
        { ...aggregate, equipmentId: null },
        { ...activity, title: supplyRequestDailyLogCanonicalTitle("SUBMISSION", aggregate), activityDate: "2026-07-30", dailyLogDate: "2026-07-30", equipmentId: "equipment-1" },
      ),
    ).toBe("EQUIPMENT_MISMATCH");
    expect(compatibilityMessage("EQUIPMENT_MISMATCH")).toMatch(/compatible/i);
  });

  it("retries only exact rollback-certain failures and stops after three attempts", async () => {
    for (const error of [
      { code: "P2034" },
      { code: "40001" },
      { code: "40P01" },
      { code: "P2010", meta: { code: "40001" } },
    ]) {
      expect(isRetryableSupplyRequestDailyLogLinkError(error)).toBe(true);
    }
    for (const error of [{ code: "P2002" }, { code: "P1001" }, new Error("40001")]) {
      expect(isRetryableSupplyRequestDailyLogLinkError(error)).toBe(false);
    }
    const operation = vi.fn(async () => {
      throw { code: "P2034" };
    });
    await expect(runSupplyRequestDailyLogLinkWithRetry(operation)).rejects.toMatchObject({ code: "RETRY_EXHAUSTED" });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("never retries business or stale-link failures", async () => {
    const operation = vi.fn(async () => {
      throw new SupplyRequestDailyLogLinkError(
        "STALE_LINK_STATE",
        "Reload.",
      );
    });
    await expect(runSupplyRequestDailyLogLinkWithRetry(operation)).rejects.toMatchObject({ code: "STALE_LINK_STATE" });
    expect(operation).toHaveBeenCalledOnce();
  });
});
