import { describe, expect, it } from "vitest";

import {
  mapSupplyRequestDayViewRecord,
  parseSupplyRequestDayViewDate,
  type SupplyRequestDayViewRecord,
} from "@/features/supply-requests/day-view-data-internal";
import { SupplyRequestDayViewError } from "@/features/supply-requests/day-view-types";

function currentVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    supplyRequestId: "request-1",
    versionNumber: 1,
    changeKind: "CREATED",
    status: "REQUESTED",
    operationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
    submittedLocalDate: new Date("2026-07-30T00:00:00.000Z"),
    submittedLocalTime: "08:15",
    equipmentId: "equipment-1",
    equipmentDisplayNameSnapshot: "Historic Dragline",
    equipmentNumberSnapshot: "133",
    equipmentCategorySnapshot: "DRAGLINE",
    mineNameSnapshot: "Historic Mine",
    cityNameSnapshot: "Historic City",
    cityStateSnapshot: "WY",
    requesterDisplayNameSnapshot: "Alain Alemany",
    requesterEmployeeNumberSnapshot: "1001",
    supervisorNameSnapshot: "Historic Supervisor",
    supervisorEmailSnapshot: "supervisor@example.com",
    notes: null,
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
    correctionReason: null,
    correctedByDisplayNameSnapshot: null,
    correctionLocalDate: null,
    correctionLocalTime: null,
    _count: { items: 2 },
    ...overrides,
  };
}

function record(
  versionOverrides: Record<string, unknown> = {},
  rootOverrides: Record<string, unknown> = {},
) {
  return {
    id: "request-1",
    namReference: "SR-2026-0001",
    currentVersionId: "version-1",
    currentVersion: currentVersion(versionOverrides),
    ...rootOverrides,
  } as SupplyRequestDayViewRecord;
}

const correction = {
  correctionReason: "Corrected historical record.",
  correctedByDisplayNameSnapshot: "Alain Alemany",
  correctionLocalDate: new Date("2026-07-31T00:00:00.000Z"),
  correctionLocalTime: "12:00",
};

describe("Supply Request Day View selected date", () => {
  it.each(["2026-07-31", "2024-02-29"])("accepts canonical date %s", (value) => {
    expect(parseSupplyRequestDayViewDate(value)).toBe(value);
  });

  it.each([
    "2026-02-29",
    "2026-7-31",
    "2026-07-31T00:00:00",
    "2026-07-31Z",
    " 2026-07-31",
    "2026-07-31 ",
    "",
    20260731,
  ])("rejects malformed direct-call date %#", (value) => {
    expect(() => parseSupplyRequestDayViewDate(value)).toThrow(
      SupplyRequestDayViewError,
    );
  });
});

describe("Supply Request Day View mapping", () => {
  it.each([
    ["CREATED", "REQUESTED", {}, "Requested"],
    [
      "FULFILLED",
      "FULFILLED",
      {
        fulfillmentOperationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
        fulfilledLocalDate: new Date("2026-07-31T00:00:00.000Z"),
        fulfilledLocalTime: "10:00",
      },
      "Fulfilled",
    ],
    [
      "CANCELLED",
      "CANCELLED",
      {
        cancelledLocalDate: new Date("2026-07-31T00:00:00.000Z"),
        cancelledLocalTime: "10:00",
      },
      "Cancelled",
    ],
    ["CORRECTED", "REQUESTED", correction, "Requested"],
    [
      "CORRECTED",
      "FULFILLED",
      {
        ...correction,
        fulfillmentOperationalWorkDate: new Date("2026-07-31T00:00:00.000Z"),
        fulfilledLocalDate: new Date("2026-07-31T00:00:00.000Z"),
        fulfilledLocalTime: "10:00",
      },
      "Fulfilled",
    ],
    [
      "CORRECTED",
      "CANCELLED",
      {
        ...correction,
        cancelledLocalDate: new Date("2026-07-31T00:00:00.000Z"),
        cancelledLocalTime: "10:00",
      },
      "Cancelled",
    ],
  ])(
    "maps %s / %s from resulting status",
    (changeKind, status, lifecycle, expected) => {
      expect(
        mapSupplyRequestDayViewRecord(
          record({ changeKind, status, ...lifecycle }),
          "2026-07-31",
        ).statusLabel,
      ).toBe(expected);
    },
  );

  it("maps only the approved snapshot-first display contract", () => {
    expect(
      mapSupplyRequestDayViewRecord(record(), "2026-07-31"),
    ).toEqual({
      supplyRequestId: "request-1",
      namReference: "SR-2026-0001",
      equipmentLabel: "Historic Dragline · 133",
      itemCount: 2,
      supervisorName: "Historic Supervisor",
      statusLabel: "Requested",
      submittedLocalDate: "2026-07-30",
      submittedLocalTime: "08:15",
      detailHref: "/supply-requests/request-1",
    });
  });

  it("supports no-number and Equipment SetNull snapshots", () => {
    expect(
      mapSupplyRequestDayViewRecord(
        record({ equipmentNumberSnapshot: null }),
        "2026-07-31",
      ).equipmentLabel,
    ).toBe("Historic Dragline");
    expect(
      mapSupplyRequestDayViewRecord(
        record({ equipmentId: null, equipmentDisplayNameSnapshot: "Deleted Truck" }),
        "2026-07-31",
      ).equipmentLabel,
    ).toBe("Deleted Truck · 133");
  });

  it.each([1, 50])("accepts current item count %i", (items) => {
    expect(
      mapSupplyRequestDayViewRecord(record({ _count: { items } }), "2026-07-31")
        .itemCount,
    ).toBe(items);
  });

  it.each([0, 51])("rejects invalid current item count %i", (items) => {
    expect(() =>
      mapSupplyRequestDayViewRecord(record({ _count: { items } }), "2026-07-31"),
    ).toThrow(SupplyRequestDayViewError);
  });

  it("encodes the stable root detail link", () => {
    const value = mapSupplyRequestDayViewRecord(
      record({}, { id: "request/with space", currentVersion: currentVersion({ supplyRequestId: "request/with space" }) }),
      "2026-07-31",
    );
    expect(value.detailHref).toBe("/supply-requests/request%2Fwith%20space");
  });

  it.each([
    ["null pointer", {}, { currentVersionId: null }],
    ["pointer mismatch", {}, { currentVersionId: "version-2" }],
    ["wrong owner", { supplyRequestId: "request-2" }, {}],
    ["invalid version", { versionNumber: 0 }, {}],
    ["invalid submitted date", { submittedLocalDate: new Date("invalid") }, {}],
    ["invalid submitted time", { submittedLocalTime: "24:00" }, {}],
    ["invalid lifecycle", { status: "FULFILLED" }, {}],
    ["invalid correction", { changeKind: "CORRECTED" }, {}],
    ["invalid snapshots", { supervisorNameSnapshot: " " }, {}],
    [
      "operational date mismatch",
      { operationalWorkDate: new Date("2026-08-01T00:00:00.000Z") },
      {},
    ],
  ])("rejects %s", (_label, versionOverrides, rootOverrides) => {
    expect(() =>
      mapSupplyRequestDayViewRecord(
        record(versionOverrides, rootOverrides),
        "2026-07-31",
      ),
    ).toThrow(SupplyRequestDayViewError);
  });
});
