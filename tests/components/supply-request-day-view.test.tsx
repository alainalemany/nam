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
  supplyRequests: vi.fn(),
  timesheets: vi.fn(),
  workAuthorizations: vi.fn(),
  workSchedules: vi.fn(),
}));

vi.mock("@/features/daily-inspections/data", () => ({ getDailyInspectionsForDate: mocks.dailyInspections }));
vi.mock("@/features/defect-tracking/data", () => ({ getDefectsForDate: mocks.defects }));
vi.mock("@/features/daily-logs/data", () => ({
  displayDateOnly: (value: Date) => value.toISOString().slice(0, 10),
  getDailyLogsForDate: mocks.dailyLogs,
}));
vi.mock("@/features/equipment-fuel-events/data", () => ({ getEquipmentFuelEventDayViewItems: mocks.fuelEvents }));
vi.mock("@/features/operational-safety-checklists/data", () => ({ getOperationalSafetyChecklistDayViewItems: mocks.safetyChecklists }));
vi.mock("@/features/shift-reports/data", () => ({ getShiftReportsForDate: mocks.shiftReports }));
vi.mock("@/features/stop-cards/data", () => ({ getStopCardsForDate: mocks.stopCards }));
vi.mock("@/features/supply-requests/day-view-data", () => ({
  getSupplyRequestDayViewItems: mocks.supplyRequests,
  supplyRequestDayViewHistoryHref: (date: string) =>
    `/supply-requests?dateFrom=${date}&dateTo=${date}&page=1`,
}));
vi.mock("@/features/work-authorizations/data", () => ({ getWorkAuthorizationsForDate: mocks.workAuthorizations }));
vi.mock("@/features/work-schedule/data", () => ({ getWorkScheduleContextsForDate: mocks.workSchedules }));
vi.mock("@/features/timesheets/data", () => ({ getTimesheetContextsForDate: mocks.timesheets }));

function item(overrides: Record<string, unknown> = {}) {
  return {
    supplyRequestId: "request-1",
    namReference: "SR-2026-0001",
    equipmentLabel: "Historic Dragline · 133",
    itemCount: 2,
    supervisorName: "Historic Supervisor",
    statusLabel: "Requested",
    submittedLocalDate: "2026-07-30",
    submittedLocalTime: "08:15",
    detailHref: "/supply-requests/request-1",
    ...overrides,
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Supply Request Day View participation", () => {
  it("passes the normalized date in the existing parallel composition", async () => {
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }));
    for (const query of Object.values(mocks)) {
      expect(query).toHaveBeenCalledOnce();
      expect(query).toHaveBeenCalledWith("2026-07-31");
    }
    const heading = screen.getByRole("heading", { name: "Supply Requests" });
    expect(heading).toBeInTheDocument();
    expect(heading.closest("section")?.querySelector(".count-pill")).toHaveTextContent("0");
  });

  it.each([
    ["Requested", "SR-2026-0001"],
    ["Fulfilled", "SR-2026-0002"],
    ["Cancelled", "SR-2026-0003"],
  ])("renders a %s pointer-owned entry", async (statusLabel, namReference) => {
    mocks.supplyRequests.mockResolvedValue([
      item({ statusLabel, namReference }),
    ]);
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }));
    expect(screen.getByText(statusLabel)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: namReference })).toBeInTheDocument();
    expect(screen.getByText("Historic Dragline · 133")).toBeInTheDocument();
    expect(screen.getByText("Historic Supervisor")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/2026-07-30 at 08:15 local/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Supply Request" })).toHaveAttribute(
      "href",
      "/supply-requests/request-1",
    );
  });

  it("renders corrected status from the display-ready resulting-status label", async () => {
    mocks.supplyRequests.mockResolvedValue([
      item({ statusLabel: "Fulfilled", namReference: "SR-CORRECTED" }),
    ]);
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }));
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
    expect(screen.queryByText("Corrected")).not.toBeInTheDocument();
  });

  it("keeps Equipment SetNull snapshots readable without item or link details", async () => {
    mocks.supplyRequests.mockResolvedValue([
      item({ equipmentLabel: "Deleted Work Truck · WT-9", itemCount: 1 }),
    ]);
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }));
    expect(screen.getByText("Deleted Work Truck · WT-9")).toBeInTheDocument();
    expect(screen.queryByText(/Correction Reason|Fulfillment Note|Daily Log Link/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the selected-date empty state and feature-owned navigation", async () => {
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }));
    expect(screen.getByRole("heading", { name: "No Supply Requests for this day" })).toBeInTheDocument();
    expect(screen.getByText(/only after they were submitted through the corporate system/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Record Submitted Request" })).toHaveAttribute(
      "href",
      "/supply-requests/new",
    );
    expect(screen.getByRole("link", { name: "Open Supply Requests" })).toHaveAttribute(
      "href",
      "/supply-requests?dateFrom=2026-07-31&dateTo=2026-07-31&page=1",
    );
  });

  it("does not convert a query failure into the Supply Request empty state", async () => {
    mocks.supplyRequests.mockRejectedValue(new Error("safe feature failure"));
    await expect(
      DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-31" }) }),
    ).rejects.toThrow("safe feature failure");
  });
});
