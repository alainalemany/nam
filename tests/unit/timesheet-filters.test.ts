import { describe, expect, it } from "vitest";

import {
  buildTimesheetHistoryWhere,
  hasTimesheetHistoryFilters,
  parseTimesheetHistoryFilters,
  timesheetHistoryPageHref,
  type TimesheetHistoryFilters,
} from "@/features/timesheets/filters";

function parse(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return parseTimesheetHistoryFilters(searchParams);
}

describe("Timesheet history filter parsing", () => {
  it("accepts real dates and trims the first repeated value", () => {
    const parsed = parse({
      dateFrom: [" 2026-07-13 ", "2026-01-01"],
      dateTo: " 2026-07-19 ",
      equipmentId: [" equipment-1 ", "equipment-2"],
      workCodeId: " code-1 ",
      workOrderId: " order-1 ",
      supportPersonId: " person-1 ",
    });

    expect(parsed).toEqual({
      filters: {
        page: 1,
        dateFrom: "2026-07-13",
        dateTo: "2026-07-19",
        equipmentId: "equipment-1",
        workCodeId: "code-1",
        workOrderId: "order-1",
        supportPersonId: "person-1",
      },
      ignoredInvalidParameters: false,
    });
  });

  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-7-01",
    "0000-01-01",
    "2026-07-13T00:00:00Z",
    "2026-07-13-extra",
    "not-a-date",
  ])("rejects impossible or malformed Gregorian date %s", (value) => {
    expect(parse({ dateFrom: value })).toEqual({
      filters: { page: 1 },
      ignoredInvalidParameters: true,
    });
  });

  it("accepts leap day in a Gregorian leap year", () => {
    expect(parse({ dateFrom: "2024-02-29" }).filters.dateFrom).toBe(
      "2024-02-29",
    );
  });

  it.each(["DRAFT", "COMPLETED"] as const)(
    "accepts supported status %s",
    (status) => {
      expect(parse({ status: ` ${status} ` }).filters.status).toBe(status);
    },
  );

  it("ignores unsupported status and boolean values while preserving valid filters", () => {
    expect(
      parse({
        status: "SUBMITTED",
        hasOvertime: "false",
        equipmentId: "equipment-1",
      }),
    ).toEqual({
      filters: { page: 1, equipmentId: "equipment-1" },
      ignoredInvalidParameters: true,
    });
  });

  it("accepts only the exact overtime value true", () => {
    expect(parse({ hasOvertime: "true" }).filters.hasOvertime).toBe(true);
    expect(parse({ hasOvertime: "TRUE" }).filters.hasOvertime).toBeUndefined();
  });

  it("does not let valid later repetitions override invalid first values", () => {
    expect(
      parse({
        dateFrom: ["not-a-date", "2026-07-13"],
        status: ["SUBMITTED", "DRAFT"],
        hasOvertime: ["false", "true"],
        page: ["0", "2"],
      }),
    ).toEqual({
      filters: { page: 1 },
      ignoredInvalidParameters: true,
    });
  });

  it.each([
    [undefined, 1, false],
    ["", 1, false],
    ["1", 1, false],
    ["0002", 2, false],
    [" 52 ", 52, false],
    ["9007199254740991", Number.MAX_SAFE_INTEGER, false],
    ["0", 1, true],
    ["-2", 1, true],
    ["1.5", 1, true],
    ["abc", 1, true],
    ["9007199254740992", 1, true],
  ] as const)(
    "normalizes page %s to %s",
    (value, expected, invalid) => {
      const parsed = parse({ page: value });
      expect(parsed.filters.page).toBe(expected);
      expect(parsed.ignoredInvalidParameters).toBe(invalid);
    },
  );

  it("ignores unknown parameters without making them active", () => {
    const parsed = parse({ q: "mine", ownerId: "owner-1", page: "3" });

    expect(parsed).toEqual({
      filters: { page: 3 },
      ignoredInvalidParameters: false,
    });
    expect(hasTimesheetHistoryFilters(parsed.filters)).toBe(false);
  });

  it("detects normalized active filters independently from page", () => {
    expect(hasTimesheetHistoryFilters({ page: 8 })).toBe(false);
    expect(
      hasTimesheetHistoryFilters({ page: 8, status: "DRAFT" }),
    ).toBe(true);
  });

  it("builds pagination links from normalized filters only", () => {
    const parsed = parse({
      dateFrom: " 2026-07-13 ",
      status: "DRAFT",
      hasOvertime: "true",
      q: "ignored",
      dateTo: "2026-02-30",
      page: "-1",
    });

    expect(timesheetHistoryPageHref(parsed.filters, 2)).toBe(
      "/timesheets?dateFrom=2026-07-13&status=DRAFT&hasOvertime=true&page=2",
    );
  });

  it("never generates a zero, negative, fractional, or unsafe page", () => {
    const filters: TimesheetHistoryFilters = { page: 1 };

    expect(timesheetHistoryPageHref(filters, 0)).toBe("/timesheets?page=1");
    expect(timesheetHistoryPageHref(filters, -5)).toBe("/timesheets?page=1");
    expect(timesheetHistoryPageHref(filters, 2.5)).toBe("/timesheets?page=1");
    expect(timesheetHistoryPageHref(filters, Number.NaN)).toBe(
      "/timesheets?page=1",
    );
  });
});

describe("Timesheet history database predicate", () => {
  const base: TimesheetHistoryFilters = { page: 1 };

  it("uses inclusive payroll-week overlap boundaries without local-time coercion", () => {
    expect(
      buildTimesheetHistoryWhere({
        ...base,
        dateFrom: "2026-07-19",
        dateTo: "2026-07-20",
      }),
    ).toEqual({
      AND: [
        {
          payrollWeekEndDate: {
            gte: new Date("2026-07-19T00:00:00.000Z"),
          },
        },
        {
          payrollWeekStartDate: {
            lte: new Date("2026-07-20T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("turns a reversed valid range into an impossible predicate without swapping", () => {
    expect(
      buildTimesheetHistoryWhere({
        ...base,
        dateFrom: "2026-07-17",
        dateTo: "2026-07-16",
      }),
    ).toEqual({
      AND: [
        {
          payrollWeekStartDate: {
            gte: new Date("2026-07-17T00:00:00.000Z"),
          },
        },
        {
          payrollWeekStartDate: {
            lt: new Date("2026-07-17T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("combines weekly status and persisted overtime with AND", () => {
    expect(
      buildTimesheetHistoryWhere({
        ...base,
        status: "COMPLETED",
        hasOvertime: true,
      }),
    ).toEqual({
      AND: [
        { status: "COMPLETED" },
        { overtimeMinutesTotal: { gt: 0 } },
      ],
    });
  });

  it("keeps Equipment and allocation filters within one Daily Time Entry", () => {
    const where = buildTimesheetHistoryWhere({
      ...base,
      equipmentId: "equipment-1",
      workCodeId: "code-1",
    });

    expect(where).toEqual({
      AND: [
        {
          entries: {
            some: {
              primaryEquipmentId: "equipment-1",
              allocations: { some: { workCodeId: "code-1" } },
            },
          },
        },
      ],
    });
  });

  it("keeps Work Code, Work Order, and Support Personnel within one Work Allocation", () => {
    const where = buildTimesheetHistoryWhere({
      ...base,
      workCodeId: "code-1",
      workOrderId: "order-1",
      supportPersonId: "person-1",
    });

    expect(where).toEqual({
      AND: [
        {
          entries: {
            some: {
              allocations: {
                some: {
                  workCodeId: "code-1",
                  workOrderId: "order-1",
                  supportPersonnel: {
                    some: { supportPersonId: "person-1" },
                  },
                },
              },
            },
          },
        },
      ],
    });
  });

  it.each([
    ["equipmentId", "equipment-1"],
    ["workCodeId", "code-1"],
    ["workOrderId", "order-1"],
    ["supportPersonId", "person-1"],
  ] as const)("supports the %s relation independently", (key, value) => {
    const where = buildTimesheetHistoryWhere({ ...base, [key]: value });
    expect(where).toHaveProperty("AND.0.entries.some");
  });

  it("combines every active filter through the weekly AND boundary", () => {
    const where = buildTimesheetHistoryWhere({
      page: 4,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      status: "DRAFT",
      equipmentId: "equipment-1",
      workCodeId: "code-1",
      workOrderId: "order-1",
      supportPersonId: "person-1",
      hasOvertime: true,
    });

    expect(where.AND).toHaveLength(5);
    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { status: "DRAFT" },
        { overtimeMinutesTotal: { gt: 0 } },
        {
          entries: {
            some: {
              primaryEquipmentId: "equipment-1",
              allocations: {
                some: {
                  workCodeId: "code-1",
                  workOrderId: "order-1",
                  supportPersonnel: {
                    some: { supportPersonId: "person-1" },
                  },
                },
              },
            },
          },
        },
      ]),
    });
  });
});
