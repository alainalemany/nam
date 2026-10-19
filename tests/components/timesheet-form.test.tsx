import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TimesheetForm } from "@/features/timesheets/TimesheetForm";
import { saveWeeklyTimesheetAction } from "@/features/timesheets/actions";

const mocks = vi.hoisted(() => ({ scheduleLoad: vi.fn().mockResolvedValue([]) }));

vi.mock("@/features/timesheets/actions", () => ({
  getWorkScheduleAssignmentsForEmployeeAction: mocks.scheduleLoad,
  saveWeeklyTimesheetAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  mocks.scheduleLoad.mockReset().mockResolvedValue([]);
});

const options = {
  employees: [
    { id: "employee-1", label: "Alex Operator (OP-1)", active: true },
    { id: "employee-2", label: "Blair Operator (OP-2)", active: true },
  ],
  equipment: [{ id: "equipment-1", label: "Dragline 1", active: true }],
  workCodes: [{ id: "code-1", label: "P-137 - Production", active: true, equipmentId: "equipment-1" }],
  workOrders: [],
  supportPersonnel: [],
  scheduleAssignments: [],
};

const initial = {
  payrollWeekStartDate: "2026-07-13",
  primaryEmployeeId: "employee-1",
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
  leaveEntries: [],
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

  it("uses the complete worked duration for one Equipment-linked allocation", async () => {
    const withoutAllocations = {
      ...initial,
      entries: initial.entries.map((entry) => ({ ...entry, allocations: [] })),
    };
    render(<TimesheetForm timesheetId="timesheet-1" initial={withoutAllocations} options={options} />);

    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    fireEvent.click(within(tuesday).getByRole("button", { name: "Use full shift" }));

    await waitFor(() => expect(within(tuesday).getByRole("combobox", { name: "Work Code" })).toHaveValue("code-1"));
    expect(within(tuesday).getByLabelText("Allocated minutes")).toHaveValue(690);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Created one full-shift allocation using the Equipment-linked Work Code",
    );
  });

  it("preserves multiple PM allocations instead of collapsing them", () => {
    const pm = {
      ...initial,
      entries: initial.entries.map((entry) => ({
        ...entry,
        allocations: [
          { ...entry.allocations[0], sequence: 1, allocatedMinutes: 300 },
          { ...entry.allocations[0], sequence: 2, allocatedMinutes: 390 },
        ],
      })),
    };
    render(<TimesheetForm timesheetId="timesheet-1" initial={pm} options={options} />);

    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    fireEvent.click(within(tuesday).getByRole("button", { name: "Use full shift" }));

    expect(within(tuesday).getAllByLabelText("Allocated minutes")).toHaveLength(2);
    expect(screen.getByText(/Multiple allocations were preserved/)).toBeInTheDocument();
  });

  it("pastes a copied day into an empty destination for review without overwriting", async () => {
    render(<TimesheetForm timesheetId="timesheet-1" initial={initial} options={options} />);
    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    const wednesday = screen.getByText("Wednesday").closest("details") as HTMLElement;

    fireEvent.click(within(tuesday).getByRole("button", { name: "Copy day" }));
    fireEvent.click(within(wednesday).getByRole("button", { name: "Paste day" }));

    await waitFor(() => expect(within(wednesday).getByLabelText("Clock in")).toHaveValue("07:00"));
    expect(within(wednesday).getByRole("combobox", { name: "Work Code" })).toHaveValue("code-1");
    const submitted = JSON.parse((document.querySelector('input[name="payload"]') as HTMLInputElement).value);
    expect(submitted.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ workDate: "2026-07-15", workScheduleDailyAssignmentId: "" }),
    ]));

    fireEvent.click(within(tuesday).getByRole("button", { name: "Paste day" }));
    expect(screen.getByText(/Paste stopped/)).toBeInTheDocument();
  });

  it("records requested FTO separately from worked and overtime totals", () => {
    render(<TimesheetForm timesheetId="timesheet-1" initial={initial} options={options} />);
    const thursday = screen.getByText("Thursday").closest("details") as HTMLElement;
    fireEvent.click(within(thursday).getByLabelText("Record an FTO request for this day"));
    fireEvent.change(within(thursday).getByLabelText("Requested FTO minutes"), { target: { value: "720" } });

    expect(within(thursday).getByText(/not approved or confirmed paid/)).toBeInTheDocument();
    const submitted = JSON.parse((document.querySelector('input[name="payload"]') as HTMLInputElement).value);
    expect(submitted.leaveEntries).toEqual([
      expect.objectContaining({ workDate: "2026-07-16", leaveType: "FTO", requestedMinutes: 720 }),
    ]);
    expect(submitted.entries).toHaveLength(1);
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

  it("loads and visibly selects the only eligible assignment without a manual action", async () => {
    mocks.scheduleLoad.mockResolvedValueOnce([{
      id: "assignment-oct-14",
      workDate: "2026-07-14",
      label: "2026-07-14 · Night · MTECK 2100E Dragline #101151",
      selectable: true,
      leaveSelectable: true,
    }]);
    const unlinked = {
      ...initial,
      entries: initial.entries.map((entry) => ({ ...entry, workScheduleDailyAssignmentId: "" })),
    };
    render(<TimesheetForm timesheetId={null} initial={unlinked} options={options} />);

    await waitFor(() => expect(mocks.scheduleLoad).toHaveBeenCalledWith(
      "employee-1",
      "2026-07-13",
      null,
    ));
    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    await waitFor(() => expect(within(tuesday).getByLabelText(/Work Schedule context/)).toHaveValue("assignment-oct-14"));
  });

  it("invalidates an automatically selected assignment and suggests the new week's only candidate", async () => {
    mocks.scheduleLoad
      .mockResolvedValueOnce([{
        id: "assignment-old",
        workDate: "2026-07-14",
        label: "2026-07-14 · Night · Old Dragline",
        selectable: true,
        leaveSelectable: true,
      }])
      .mockResolvedValueOnce([{
        id: "assignment-new",
        workDate: "2026-07-21",
        label: "2026-07-21 · Night · New Dragline",
        selectable: true,
        leaveSelectable: true,
      }]);
    render(<TimesheetForm timesheetId={null} initial={initial} options={options} />);
    const week = screen.getByLabelText("Week starting Monday");
    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    const assignment = within(tuesday).getByLabelText(/Work Schedule context/);
    await waitFor(() => expect(assignment).toHaveValue("assignment-old"));

    fireEvent.change(week, { target: { value: "2026-07-20" } });

    await waitFor(() => expect(mocks.scheduleLoad).toHaveBeenCalledWith("employee-1", "2026-07-20", null));
    const updatedTuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    await waitFor(() => expect(within(updatedTuesday).getByLabelText(/Work Schedule context/)).toHaveValue("assignment-new"));
    expect(within(updatedTuesday).getByLabelText("Clock in")).toHaveValue("07:00");
    const submitted = JSON.parse((document.querySelector('input[name="payload"]') as HTMLInputElement).value);
    expect(submitted.entries[0]).toMatchObject({
      clockIn: "07:00",
      unpaidBreakMinutes: 30,
      allocations: [expect.objectContaining({ workCodeId: "code-1", allocatedMinutes: 690 })],
    });
  });

  it("clears a manually selected previous-week assignment when the new week has no candidates", async () => {
    mocks.scheduleLoad
      .mockResolvedValueOnce([
        { id: "assignment-a", workDate: "2026-07-14", label: "Assignment A", selectable: true, leaveSelectable: true },
        { id: "assignment-b", workDate: "2026-07-14", label: "Assignment B", selectable: true, leaveSelectable: true },
      ])
      .mockResolvedValueOnce([]);
    render(<TimesheetForm timesheetId={null} initial={initial} options={options} />);
    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    const assignment = within(tuesday).getByLabelText(/Work Schedule context/);
    await waitFor(() => expect(within(assignment).getAllByRole("option")).toHaveLength(3));
    fireEvent.change(assignment, { target: { value: "assignment-b" } });
    expect(assignment).toHaveValue("assignment-b");

    fireEvent.change(screen.getByLabelText("Week starting Monday"), { target: { value: "2026-07-20" } });

    const updatedTuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    await waitFor(() => expect(within(updatedTuesday).getByLabelText(/Work Schedule context/)).toHaveValue(""));
    await waitFor(() => expect(within(updatedTuesday).getByText("No eligible scheduled assignment. Unscheduled work is allowed.")).toBeInTheDocument());
  });

  it("ignores stale assignment responses during rapid employee and week changes", async () => {
    let resolveInitial!: (value: Awaited<ReturnType<typeof mocks.scheduleLoad>>) => void;
    let resolveEmployee!: (value: Awaited<ReturnType<typeof mocks.scheduleLoad>>) => void;
    const initialRequest = new Promise<unknown[]>((resolve) => { resolveInitial = resolve; });
    const employeeRequest = new Promise<unknown[]>((resolve) => { resolveEmployee = resolve; });
    mocks.scheduleLoad.mockImplementation((employeeId: string, weekStart: string) => {
      if (employeeId === "employee-1") return initialRequest;
      if (weekStart === "2026-07-13") return employeeRequest;
      return Promise.resolve([{
        id: "assignment-current",
        workDate: "2026-07-21",
        label: "Current employee and week assignment",
        selectable: true,
        leaveSelectable: true,
      }]);
    });
    render(<TimesheetForm timesheetId={null} initial={initial} options={options} />);
    await waitFor(() => expect(mocks.scheduleLoad).toHaveBeenCalledWith("employee-1", "2026-07-13", null));

    fireEvent.change(screen.getByLabelText("Primary employee"), { target: { value: "employee-2" } });
    await waitFor(() => expect(mocks.scheduleLoad).toHaveBeenCalledWith("employee-2", "2026-07-13", null));
    fireEvent.change(screen.getByLabelText("Week starting Monday"), { target: { value: "2026-07-20" } });
    await waitFor(() => expect(mocks.scheduleLoad).toHaveBeenCalledWith("employee-2", "2026-07-20", null));

    const tuesday = screen.getByText("Tuesday").closest("details") as HTMLElement;
    const assignment = within(tuesday).getByLabelText(/Work Schedule context/);
    await waitFor(() => expect(assignment).toHaveValue("assignment-current"));
    await act(async () => {
      resolveInitial([{ id: "assignment-stale-1", workDate: "2026-07-14", label: "Stale", selectable: true, leaveSelectable: true }]);
      resolveEmployee([{ id: "assignment-stale-2", workDate: "2026-07-14", label: "Stale", selectable: true, leaveSelectable: true }]);
      await Promise.resolve();
    });
    expect(assignment).toHaveValue("assignment-current");
  });
});
