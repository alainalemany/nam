import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DayViewPage from "@/app/day-view/page";

const mocks = vi.hoisted(() => ({
  dailyInspections: vi.fn(),
  dailyLogs: vi.fn(),
  defects: vi.fn(),
  fuelEvents: vi.fn(),
  safetyChecklists: vi.fn(),
  shiftReports: vi.fn(),
  stopCards: vi.fn(),
  timesheets: vi.fn(),
  workAuthorizations: vi.fn(),
  workSchedules: vi.fn(),
}));

vi.mock("@/features/daily-inspections/data", () => ({ getDailyInspectionsForDate: mocks.dailyInspections }));
vi.mock("@/features/defect-tracking/data", () => ({ getDefectsForDate: mocks.defects }));
vi.mock("@/features/daily-logs/data", () => ({
  displayDateOnly: (value: Date) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(value),
  getDailyLogsForDate: mocks.dailyLogs,
}));
vi.mock("@/features/equipment-fuel-events/data", () => ({ getEquipmentFuelEventDayViewItems: mocks.fuelEvents }));
vi.mock("@/features/operational-safety-checklists/data", () => ({ getOperationalSafetyChecklistDayViewItems: mocks.safetyChecklists }));
vi.mock("@/features/shift-reports/data", () => ({ getShiftReportsForDate: mocks.shiftReports }));
vi.mock("@/features/stop-cards/data", () => ({ getStopCardsForDate: mocks.stopCards }));
vi.mock("@/features/work-authorizations/data", () => ({ getWorkAuthorizationsForDate: mocks.workAuthorizations }));
vi.mock("@/features/work-schedule/data", () => ({ getWorkScheduleContextsForDate: mocks.workSchedules }));
vi.mock("@/features/timesheets/data", () => ({ getTimesheetContextsForDate: mocks.timesheets }));

const originalTimezone = process.env.TZ;

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("Day View composition", () => {
  it("preserves all eight contributors and adds the two explicit operational sections", async () => {
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-13" }) }));

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Jul 13, 2026",
      "Work Schedule",
      "Timesheet",
      "Daily Logs",
      "STOP Cards",
      "Daily Inspections",
      "Operational Safety Checklists",
      "Shift Reports",
      "Work Authorizations",
      "Defects",
      "Equipment Fuel Events",
    ]);
    expect(screen.getByRole("heading", { name: "No Timesheet entry for this day" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No operational safety checklists for this day" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No equipment fuel events for this day" })).toBeInTheDocument();
    for (const query of Object.values(mocks)) {
      expect(query).toHaveBeenCalledWith("2026-07-13");
    }
  });

  it("falls back from an impossible date before invoking every contributor", async () => {
    process.env.TZ = "UTC";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T01:00:00.000Z"));

    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-02-31" }) }));

    for (const query of Object.values(mocks)) {
      expect(query).toHaveBeenCalledWith("2026-07-17");
      expect(query).not.toHaveBeenCalledWith("2026-02-31");
      expect(query).not.toHaveBeenCalledWith("2026-03-03");
    }
    expect(screen.getByRole("heading", { name: "Jul 17, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous Day" })).toHaveAttribute(
      "href",
      "/day-view?date=2026-07-16",
    );
    expect(screen.getByRole("link", { name: "Next Day" })).toHaveAttribute(
      "href",
      "/day-view?date=2026-07-18",
    );
  });

  it("loads both feature contributions for the selected date and renders source links", async () => {
    mocks.safetyChecklists.mockResolvedValue([
      {
        id: "checklist-1",
        equipmentIdentity: "Historic Work Truck With A Very Long Operational Display Name #WT-8",
        templateIdentity: "Mobile Inspection V1",
        shift: "Night",
        meter: "88,001 Miles",
        needsRepairCount: 1,
        previouslyNotedCount: 2,
        detailHref: "/operational-safety-checklists/checklist-1",
      },
    ]);
    mocks.fuelEvents.mockResolvedValue([
      {
        id: "event-1",
        eventTime: "23:45 local",
        equipmentIdentity: "Historic Dragline #133",
        fuelType: "Off-road Diesel",
        totalGallons: "725 gal",
        tankFills: [
          { sequence: 1, summary: "Main Tank With A Long Historical Label: 700 gal" },
          { sequence: 2, summary: "Auxiliary Tank: 25 gal" },
        ],
        fuelServicePerson: "Historic Fuel Service Person With A Long Display Name",
        detailHref: "/equipment-fuel-events/event-1",
      },
    ]);

    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-13" }) }));

    expect(mocks.safetyChecklists).toHaveBeenCalledWith("2026-07-13");
    expect(mocks.fuelEvents).toHaveBeenCalledWith("2026-07-13");
    expect(screen.getByText(/Starting meter: 88,001 Miles/)).toBeInTheDocument();
    expect(screen.getByText(/Off-road Diesel/)).toBeInTheDocument();
    expect(screen.getByText("Delivered: 725 gal")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Safety Checklist" })).toHaveAttribute(
      "href",
      "/operational-safety-checklists/checklist-1",
    );
    expect(screen.getByRole("link", { name: "View Fuel Event" })).toHaveAttribute(
      "href",
      "/equipment-fuel-events/event-1",
    );
  });

  it("starts the fuel query while the checklist contribution is still pending", async () => {
    let resolveChecklists: ((value: []) => void) | undefined;
    mocks.safetyChecklists.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveChecklists = resolve;
      }),
    );

    const page = DayViewPage({
      searchParams: Promise.resolve({ date: "2026-07-13" }),
    });

    await vi.waitFor(() => {
      expect(mocks.safetyChecklists).toHaveBeenCalledWith("2026-07-13");
      expect(mocks.fuelEvents).toHaveBeenCalledWith("2026-07-13");
    });
    resolveChecklists?.([]);
    render(await page);
  });

  it("keeps one operational section useful when the other has no records", async () => {
    mocks.safetyChecklists.mockResolvedValue([
      {
        id: "checklist-1",
        equipmentIdentity: "Historic Tractor",
        templateIdentity: "Mobile Inspection V1",
        shift: "Day",
        meter: "1,250 Hours",
        needsRepairCount: 0,
        previouslyNotedCount: 0,
        detailHref: "/operational-safety-checklists/checklist-1",
      },
    ]);

    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-13" }) }));

    expect(screen.getByRole("heading", { name: "Historic Tractor" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No equipment fuel events for this day" }),
    ).toBeInTheDocument();
  });
});
