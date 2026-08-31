import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultScheduleRangeInitialValues } from "@/features/work-schedule/data";
import { emptyScheduleRangeFormState } from "@/features/work-schedule/range-state";
import { ScheduleRangeForm } from "@/features/work-schedule/ScheduleRangeForm";
import type {
  ScheduleRangeFormInitialValues,
  WorkScheduleAssignmentInitialValues,
} from "@/features/work-schedule/types";

afterEach(cleanup);

const employees = [
  { id: "employee-1", label: "Alex Operator", isActive: true, isSupervisor: false },
  { id: "partner-1", label: "Jordan Partner", isActive: true, isSupervisor: false },
];
const supervisors = [
  { id: "supervisor-1", label: "Sam Supervisor", isActive: true, isSupervisor: true },
];
const equipment = [{ id: "equipment-1", label: "Dragline 7" }];

function renderForm(action = vi.fn().mockResolvedValue(emptyScheduleRangeFormState)) {
  return render(
    <ScheduleRangeForm
      action={action}
      cancelHref="/work-schedule"
      employeeOptions={employees}
      equipmentOptions={equipment}
      initialValues={defaultScheduleRangeInitialValues("2026-08-31", "2026-09-08", "employee-1")}
      supervisorOptions={supervisors}
    />,
  );
}

function persistedAssignment(
  assignmentDate: string,
  plannedShift: "DAY" | "NIGHT",
  plannedStatus: "SCHEDULED" | "NON_WORKING" = "SCHEDULED",
): WorkScheduleAssignmentInitialValues {
  const assignment = defaultScheduleRangeInitialValues(
    assignmentDate,
    assignmentDate,
    "employee-1",
  ).assignments[0];
  const off = plannedStatus === "NON_WORKING";
  return {
    ...assignment,
    plannedStatus,
    plannedShift: off ? "UNKNOWN" : plannedShift,
    plannedEquipmentId: off ? "" : "equipment-1",
    plannedPrimaryEmployeeId: off ? "" : "employee-1",
    plannedPartnerEmployeeId: off ? "" : "partner-1",
    plannedPartnerDisplayName: off ? "" : "Jordan Partner",
    actualStatus: off ? "NON_WORKING" : "UNKNOWN",
  };
}

function persistedRange(startDate: string, endDate: string) {
  const values = defaultScheduleRangeInitialValues(startDate, endDate, "employee-1");
  return values.assignments.map((assignment, index) =>
    persistedAssignment(
      assignment.assignmentDate,
      index === 0 ? "DAY" : "NIGHT",
      assignment.assignmentDate === "2026-09-01" ? "NON_WORKING" : "SCHEDULED",
    ),
  );
}

function editInitialValues(
  startDate = "2026-08-31",
  endDate = "2026-09-06",
  assignments = persistedRange(startDate, endDate),
): ScheduleRangeFormInitialValues {
  return {
    ...defaultScheduleRangeInitialValues(startDate, endDate, "employee-1"),
    isNew: false,
    assignedByEmployeeId: "supervisor-1",
    assignments,
  };
}

function renderEditForm(
  initialValues: ScheduleRangeFormInitialValues,
  loadAssignments = vi.fn().mockResolvedValue({
    status: "success" as const,
    assignments: initialValues.assignments,
  }),
  action = vi.fn().mockResolvedValue(emptyScheduleRangeFormState),
) {
  return {
    action,
    loadAssignments,
    ...render(
      <ScheduleRangeForm
        action={action}
        cancelHref="/work-schedule"
        employeeOptions={employees}
        equipmentOptions={equipment}
        initialValues={initialValues}
        loadAssignments={loadAssignments}
        supervisorOptions={supervisors}
      />,
    ),
  };
}

describe("ScheduleRangeForm", () => {
  it("renders August 31-September 8 as one continuous responsive day list", () => {
    renderForm();
    expect(screen.getByLabelText("Start Date")).toHaveValue("2026-08-31");
    expect(screen.getByLabelText("End Date")).toHaveValue("2026-09-08");
    expect(screen.getByText("9 continuous days")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mon Aug 31" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Sun Sep 6" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Mon Sep 7" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tue Sep 8" })).toBeInTheDocument();
    expect(screen.queryByText(/week boundary/i)).not.toBeInTheDocument();
  });

  it("rebuilds the continuous rows when the selected range changes", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-03" } });
    expect(screen.getByText("4 continuous days")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Fri Sep 4" })).not.toBeInTheDocument();
  });

  it("marks an individual date Off and removes fields that do not apply", () => {
    renderForm();
    const statuses = screen.getAllByLabelText("Planned status");
    fireEvent.change(statuses[1], { target: { value: "NON_WORKING" } });

    const tuesday = screen.getByRole("group", { name: "Tue Sep 1" });
    expect(tuesday).toHaveClass("work-schedule-day--non-working");
    expect(screen.getAllByText("Off").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Shift")[1]).toBeDisabled();
    expect(screen.getAllByLabelText("Equipment")[1]).toBeDisabled();
    expect(screen.getAllByLabelText("Planned partner")[1]).toBeDisabled();
  });

  it("keeps actual assignment fields available without making the planned list horizontal", () => {
    renderForm();
    const details = screen.getAllByText("Actual assignment and change details");
    expect(details).toHaveLength(9);
    fireEvent.click(details[0]);
    expect(screen.getAllByLabelText("Actual shift")[0]).toHaveValue("UNKNOWN");
  });

  it("requires an explicit acknowledgement after the server reports conflicting dates", async () => {
    const conflictAction = vi.fn().mockResolvedValue({
      ...emptyScheduleRangeFormState,
      status: "conflict" as const,
      message: "Existing planned assignments were found in this date range.",
      conflictDates: ["2026-08-31", "2026-09-07"],
    });
    renderForm(conflictAction);
    fireEvent.submit(screen.getByRole("button", { name: "Save schedule" }).closest("form")!);

    const confirmation = await screen.findByRole("checkbox", { name: /I reviewed these dates/i });
    expect(screen.getByRole("alert")).toHaveTextContent("2026-08-31, 2026-09-07");
    expect(screen.getByRole("button", { name: "Confirm and save range" })).toBeDisabled();
    fireEvent.click(confirmation);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm and save range" })).toBeEnabled());
  });

  it("renders a server-hydrated cross-week edit range with all persisted values", () => {
    renderEditForm(editInitialValues(
      "2026-08-31",
      "2026-09-08",
      persistedRange("2026-08-31", "2026-09-08"),
    ));

    expect(screen.getByText("9 continuous days")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Mon Aug 31" })).getByLabelText("Shift"))
      .toHaveValue("DAY");
    expect(within(screen.getByRole("group", { name: "Tue Sep 1" })).getByLabelText("Shift"))
      .toBeDisabled();
    expect(within(screen.getByRole("group", { name: "Mon Sep 7" })).getByLabelText("Shift"))
      .toHaveValue("NIGHT");
    expect(within(screen.getByRole("group", { name: "Tue Sep 8" })).getByLabelText("Shift"))
      .toHaveValue("NIGHT");
  });

  it("hydrates persisted adjacent-week assignments when End Date is extended", async () => {
    const initialValues = editInitialValues();
    const loadAssignments = vi.fn().mockResolvedValue({
      status: "success" as const,
      assignments: persistedRange("2026-08-31", "2026-09-08"),
    });
    renderEditForm(initialValues, loadAssignments);

    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-08" } });

    expect(await screen.findByText("9 continuous days")).toBeInTheDocument();
    expect(loadAssignments).toHaveBeenCalledWith("2026-08-31", "2026-09-08");
    expect(within(screen.getByRole("group", { name: "Mon Sep 7" })).getByLabelText("Shift"))
      .toHaveValue("NIGHT");
    expect(within(screen.getByRole("group", { name: "Tue Sep 8" })).getByLabelText("Planned partner"))
      .toHaveValue("partner-1");
  });

  it("defaults only genuinely new dates after hydrating persisted adjacent dates", async () => {
    const loadAssignments = vi.fn().mockResolvedValue({
      status: "success" as const,
      assignments: persistedRange("2026-08-31", "2026-09-08"),
    });
    renderEditForm(editInitialValues(), loadAssignments);

    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-10" } });

    expect(await screen.findByText("11 continuous days")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Tue Sep 8" })).getByLabelText("Shift"))
      .toHaveValue("NIGHT");
    expect(within(screen.getByRole("group", { name: "Wed Sep 9" })).getByLabelText("Shift"))
      .toHaveValue("UNKNOWN");
    expect(within(screen.getByRole("group", { name: "Thu Sep 10" })).getByLabelText("Equipment"))
      .toHaveValue("");
  });

  it("preserves dirty visible rows while adjacent dates hydrate", async () => {
    const loadAssignments = vi.fn().mockResolvedValue({
      status: "success" as const,
      assignments: persistedRange("2026-08-31", "2026-09-08"),
    });
    renderEditForm(editInitialValues(), loadAssignments);
    const monday = screen.getByRole("group", { name: "Mon Aug 31" });
    fireEvent.change(within(monday).getByLabelText("Shift"), { target: { value: "NIGHT" } });

    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-08" } });

    await screen.findByText("9 continuous days");
    expect(within(screen.getByRole("group", { name: "Mon Aug 31" })).getByLabelText("Shift"))
      .toHaveValue("NIGHT");
  });

  it("hydrates Off without equipment or partner fields", async () => {
    const hydrated = persistedRange("2026-08-31", "2026-09-08");
    hydrated[7] = persistedAssignment("2026-09-07", "NIGHT", "NON_WORKING");
    renderEditForm(editInitialValues(), vi.fn().mockResolvedValue({
      status: "success" as const,
      assignments: hydrated,
    }));

    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-08" } });

    const monday = await screen.findByRole("group", { name: "Mon Sep 7" });
    expect(monday).toHaveClass("work-schedule-day--non-working");
    expect(within(monday).getByLabelText("Shift")).toBeDisabled();
    expect(within(monday).getByLabelText("Equipment")).toHaveValue("");
    expect(within(monday).getByLabelText("Planned partner")).toHaveValue("");
  });

  it("contracts the submitted range without invoking a save or retaining hidden dates", async () => {
    const loadAssignments = vi.fn().mockResolvedValue({
      status: "success" as const,
      assignments: persistedRange("2026-08-31", "2026-09-08"),
    });
    const { action } = renderEditForm(editInitialValues(), loadAssignments);
    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-08" } });
    await screen.findByText("9 continuous days");

    fireEvent.change(screen.getByLabelText("End Date"), { target: { value: "2026-09-04" } });

    expect(screen.getByText("5 continuous days")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Mon Sep 7" })).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
