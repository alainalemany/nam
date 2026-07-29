import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TimesheetsPage from "@/app/timesheets/page";

const mocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  getOptions: vi.fn(),
}));

vi.mock("@/features/timesheets/data", () => ({
  getTimesheetHistory: mocks.getHistory,
  getTimesheetHistoryFilterOptions: mocks.getOptions,
}));

const filterOptions = {
  equipment: [
    { id: "equipment-1", label: "Dragline (#137) - North Mine", active: true },
  ],
  workCodes: [
    { id: "code-1", label: "P-137 - Production", active: false },
  ],
  workOrders: [
    { id: "order-1", label: "WO-88 - Boom repair", active: false },
  ],
  supportPersonnel: [
    { id: "person-1", label: "Pat Smith - Mechanic", active: false },
  ],
};

function listItem(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "timesheet-draft",
    payrollWeekStartDate: new Date("2026-07-13T00:00:00.000Z"),
    payrollWeekEndDate: new Date("2026-07-19T00:00:00.000Z"),
    status: "DRAFT",
    primaryEmployeeDisplayName: "Alex Operator",
    workedMinutesTotal: 690,
    regularMinutesTotal: 600,
    overtimeMinutesTotal: 90,
    entryCount: 1,
    entries: [
      {
        id: "entry-1",
        workDate: new Date("2026-07-14T00:00:00.000Z"),
        equipmentCategory: "DRAGLINE",
        equipmentIdentity:
          "Historic Dragline #HD-1 (Historic Mine - Historic City, WY)",
        workedMinutes: 690,
        regularMinutes: 600,
        overtimeMinutes: 90,
        allocationSummaries: [
          "P-OLD - Historic Production · WO-OLD - Historic Repair · Historic Pat Smith (Mechanic, Historic Mechanics Co) · 11:30 allocated",
        ],
      },
    ],
    ...overrides,
  };
}

function history(
  overrides: Record<string, unknown> = {},
) {
  return {
    items: [listItem()],
    totalCount: 1,
    matchingCount: 1,
    page: 1,
    hasPreviousPage: false,
    hasNextPage: false,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getHistory.mockResolvedValue(history());
  mocks.getOptions.mockResolvedValue(filterOptions);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Timesheet History page", () => {
  it("renders Weekly Timesheets with compact snapshot-based Daily Time Entry summaries", async () => {
    mocks.getHistory.mockResolvedValue(
      history({
        items: [
          listItem(),
          listItem({
            id: "timesheet-completed",
            status: "COMPLETED",
            primaryEmployeeDisplayName: "Blair Operator",
          }),
        ],
        totalCount: 2,
        matchingCount: 2,
      }),
    );

    render(await TimesheetsPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Timesheet history" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Historic Dragline #HD-1 (Historic Mine - Historic City, WY)",
        { exact: false },
      ),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(/P-OLD - Historic Production/),
    ).toHaveLength(2);
    expect(screen.getAllByText(/11:30 allocated/)).toHaveLength(2);
    expect(screen.getAllByText(/· Dragline/)).toHaveLength(2);
    expect(screen.getAllByLabelText("1 Daily Time Entries")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Open Payroll Week" }),
    ).toHaveAttribute("href", "/timesheets/new");
    expect(screen.getAllByRole("link", { name: "View" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Edit" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/timesheets/timesheet-draft/edit",
    );
  });

  it("reflects normalized filters, inactive references, and Clear Filters", async () => {
    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({
          dateFrom: " 2026-07-13 ",
          status: " DRAFT ",
          workCodeId: " code-1 ",
          hasOvertime: "true",
        }),
      }),
    );

    expect(screen.getByLabelText("Payroll week from")).toHaveValue(
      "2026-07-13",
    );
    expect(screen.getByLabelText("Status")).toHaveValue("DRAFT");
    expect(screen.getByLabelText("Work Code")).toHaveValue("code-1");
    expect(screen.getByLabelText("Overtime")).toHaveValue("true");
    expect(
      within(screen.getByLabelText("Work Code")).getByRole("option", {
        name: "P-137 - Production (Inactive)",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear Filters" })).toHaveAttribute(
      "href",
      "/timesheets",
    );
  });

  it("keeps a normalized missing reference selected without creating it", async () => {
    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({ equipmentId: "deleted-equipment" }),
      }),
    );

    expect(screen.getByLabelText("Equipment")).toHaveValue("deleted-equipment");
    expect(
      screen.getByRole("option", {
        name: "Unavailable historical reference",
      }),
    ).toBeInTheDocument();
  });

  it("ignores malformed values, keeps valid results, and shows a concise notice", async () => {
    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({
          dateFrom: "2026-02-30",
          status: "DRAFT",
          hasOvertime: "false",
          page: "-3",
          q: "ignored",
        }),
      }),
    );

    expect(mocks.getHistory).toHaveBeenCalledWith({
      page: 1,
      status: "DRAFT",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Some invalid Timesheet filter parameters were ignored.",
    );
    expect(screen.getByText("Alex Operator")).toBeInTheDocument();
  });

  it("does not show Clear Filters when page is the only normalized parameter", async () => {
    mocks.getHistory.mockResolvedValue(
      history({ page: 2, hasPreviousPage: true }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );

    expect(
      screen.queryByRole("link", { name: "Clear Filters" }),
    ).not.toBeInTheDocument();
  });

  it("preserves only normalized active filters in pagination links", async () => {
    mocks.getHistory.mockResolvedValue(
      history({ matchingCount: 101, hasNextPage: true }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({
          dateFrom: "2026-07-13",
          equipmentId: " equipment-1 ",
          hasOvertime: "true",
          dateTo: "invalid",
          q: "ignored",
        }),
      }),
    );

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/timesheets?dateFrom=2026-07-13&equipmentId=equipment-1&hasOvertime=true&page=2",
    );
  });

  it("distinguishes the no-Timesheets state", async () => {
    mocks.getHistory.mockResolvedValue(
      history({ items: [], totalCount: 0, matchingCount: 0 }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({ status: "DRAFT" }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "No Timesheets yet" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "No Timesheets match these filters",
      }),
    ).not.toBeInTheDocument();
  });

  it("distinguishes no filtered matches and provides the clear path", async () => {
    mocks.getHistory.mockResolvedValue(
      history({ items: [], totalCount: 4, matchingCount: 0 }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({ status: "COMPLETED" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "No Timesheets match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Clear Filters" })[1]).toHaveAttribute(
      "href",
      "/timesheets",
    );
  });

  it("distinguishes an empty requested page and links safely backward", async () => {
    mocks.getHistory.mockResolvedValue(
      history({
        items: [],
        totalCount: 60,
        matchingCount: 60,
        page: 3,
        hasPreviousPage: true,
      }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({
          status: "DRAFT",
          page: "3",
          q: "ignored",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "No Timesheets on this page" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/timesheets?status=DRAFT&page=2",
    );
  });

  it("does not mislabel a later page when active filters have no matches anywhere", async () => {
    mocks.getHistory.mockResolvedValue(
      history({
        items: [],
        totalCount: 4,
        matchingCount: 0,
        page: 3,
        hasPreviousPage: true,
      }),
    );

    render(
      await TimesheetsPage({
        searchParams: Promise.resolve({
          status: "COMPLETED",
          page: "3",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "No Timesheets match these filters",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No Timesheets on this page" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Previous" }),
    ).not.toBeInTheDocument();
  });
});
