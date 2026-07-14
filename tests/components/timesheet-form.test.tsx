import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimesheetForm } from "@/features/timesheets/TimesheetForm";
import { saveWeeklyTimesheetAction } from "@/features/timesheets/actions";

vi.mock("@/features/timesheets/actions", () => ({
  getWorkScheduleAssignmentsForOwnerAction: vi.fn().mockResolvedValue([]),
  saveWeeklyTimesheetAction: vi.fn(),
}));

afterEach(cleanup);

const options = {
  equipment: [{ id: "equipment-1", label: "Dragline 1", active: true }],
  workCodes: [{ id: "code-1", label: "P-137 - Production", active: true }],
  workOrders: [],
  supportPersonnel: [],
  scheduleAssignments: [],
};

const initial = {
  payrollWeekStartDate: "2026-07-13",
  primaryEmployeeDisplayName: "Alex Operator",
  entries: [{
    workDate: "2026-07-14",
    clockIn: "07:00",
    clockOut: "19:00",
    unpaidBreakMinutes: 30,
    primaryEquipmentId: "equipment-1",
    workScheduleDailyAssignmentId: "",
    notes: "",
    allocations: [{
      sequence: 1,
      workCodeId: "code-1",
      workOrderId: "",
      allocatedMinutes: 690,
      supportPersonIds: [],
      notes: "",
    }],
  }],
};

describe("TimesheetForm", () => {
  it("keeps a Tuesday editor expanded while its inputs change", () => {
    render(<TimesheetForm timesheetId="timesheet-1" initial={initial} options={options} />);

    const tuesdaySummary = screen.getByText("Tuesday").closest("summary");
    const tuesday = tuesdaySummary?.closest("details");
    expect(tuesday).toHaveAttribute("open");

    const notes = within(tuesday as HTMLElement).getByLabelText("Daily notes");
    fireEvent.change(notes, { target: { value: "Updated Tuesday notes" } });

    expect(tuesday).toHaveAttribute("open");
    expect(notes).toHaveValue("Updated Tuesday notes");
  });

  it("shows daily and weekly calculation and reconciliation previews", () => {
    render(<TimesheetForm timesheetId="timesheet-1" initial={initial} options={options} />);

    expect(screen.getByRole("heading", { name: "Weekly totals" })).toBeInTheDocument();
    const preview = screen.getByLabelText("Tuesday calculation preview");
    expect(within(preview).getAllByText("11:30", { selector: "strong" })).toHaveLength(3);
    expect(within(preview).getByText("Balanced")).toBeInTheDocument();
  });

  it("keeps day-specific validation feedback beside the affected field", async () => {
    vi.mocked(saveWeeklyTimesheetAction).mockResolvedValueOnce({
      status: "error",
      message: "Check the highlighted Timesheet fields and try again.",
      fieldErrors: { "entries.0.clockOut": ["Use HH:MM time."] },
    });
    render(<TimesheetForm timesheetId="timesheet-1" initial={initial} options={options} />);

    fireEvent.submit(screen.getByRole("button", { name: "Save Draft" }).closest("form") as HTMLFormElement);

    const tuesday = screen.getByText("Tuesday").closest("details");
    const clockOutField = within(tuesday as HTMLElement).getByText("Clock out").closest("label");
    expect(await within(clockOutField as HTMLElement).findByText("Use HH:MM time.")).toBeInTheDocument();
    expect(tuesday).toHaveAttribute("open");
  });
});
