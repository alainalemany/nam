import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DayViewPage from "@/app/day-view/page";

vi.mock("@/features/daily-inspections/data", () => ({ getDailyInspectionsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/defect-tracking/data", () => ({ getDefectsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/daily-logs/data", () => ({
  displayDateOnly: () => "Jul 13, 2026",
  getDailyLogsForDate: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/shift-reports/data", () => ({ getShiftReportsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/stop-cards/data", () => ({ getStopCardsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/work-authorizations/data", () => ({ getWorkAuthorizationsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/work-schedule/data", () => ({ getWorkScheduleContextsForDate: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/timesheets/data", () => ({ getTimesheetContextsForDate: vi.fn().mockResolvedValue([]) }));

describe("Day View Timesheet composition", () => {
  it("places Timesheet after Work Schedule and preserves every existing module", async () => {
    render(await DayViewPage({ searchParams: Promise.resolve({ date: "2026-07-13" }) }));

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Jul 13, 2026",
      "Work Schedule",
      "Timesheet",
      "Daily Logs",
      "STOP Cards",
      "Daily Inspections",
      "Shift Reports",
      "Work Authorizations",
      "Defects",
    ]);
    expect(screen.getByRole("heading", { name: "No Timesheet entry for this day" })).toBeInTheDocument();
  });
});
