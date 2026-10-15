import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getById: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("not-found"); }),
}));
vi.mock("@/features/timesheets/data", () => ({
  getWeeklyTimesheetById: mocks.getById,
}));
vi.mock("@/features/timesheets/TimesheetLifecycleActions", () => ({
  CompleteTimesheetButton: () => <button>Complete Timesheet</button>,
  DeleteTimesheetButton: () => <button>Delete Draft</button>,
  ReopenTimesheetButton: () => <button>Reopen to Draft</button>,
}));

import TimesheetDetailPage from "@/app/timesheets/[id]/page";

afterEach(cleanup);

describe("Timesheet quarantine detail", () => {
  it("keeps historical evidence readable without exposing ordinary mutations", async () => {
    mocks.getById.mockResolvedValue({
      id: "historical-timesheet",
      payrollWeekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      payrollWeekEndDate: new Date("2026-06-07T00:00:00.000Z"),
      status: "DRAFT",
      primaryEmployeeDisplayName: "Historical Operator Snapshot",
      primaryEmployeeId: null,
      primaryEmployeeIdentityStatus: "NEEDS_REVIEW",
      workedMinutesTotal: 600,
      regularMinutesTotal: 600,
      overtimeMinutesTotal: 0,
      entries: [],
    });

    render(await TimesheetDetailPage({ params: Promise.resolve({ id: "historical-timesheet" }) }));

    expect(screen.getByRole("heading", { name: "Historical Operator Snapshot" })).toBeInTheDocument();
    expect(screen.getByText(/Historical ownership must be reviewed/)).toBeInTheDocument();
    expect(screen.getByText(/not confirmed Payroll evidence/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete Timesheet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reopen to Draft" })).not.toBeInTheDocument();
  });
});
