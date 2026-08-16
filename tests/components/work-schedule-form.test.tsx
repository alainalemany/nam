import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultWorkScheduleInitialValues } from "@/features/work-schedule/data";
import { WorkScheduleForm } from "@/features/work-schedule/WorkScheduleForm";

afterEach(cleanup);

const action = vi.fn().mockResolvedValue({
  status: "idle" as const,
  message: "",
  fieldErrors: {},
  assignmentErrors: {},
});

const employeeOptions = [
  { id: "employee-1", label: "Alain Alemany Arana (911601)", employeeCode: "911601", isActive: true, isSupervisor: false },
  { id: "employee-2", label: "Jordan Partner (200)", employeeCode: "200", isActive: true, isSupervisor: false },
  { id: "employee-3", label: "Casey Partner (300)", employeeCode: "300", isActive: true, isSupervisor: false },
];

const supervisorOptions = [
  { id: "supervisor-1", label: "Sam Supervisor (400)", employeeCode: "400", isActive: true, isSupervisor: true },
];

function renderForm(initialValues = defaultWorkScheduleInitialValues("2026-08-17", "employee-1")) {
  return render(
    <WorkScheduleForm
      action={action}
      cancelHref="/work-schedule"
      employeeOptions={employeeOptions}
      equipmentOptions={[]}
      initialValues={initialValues}
      submitLabel="Save Work Schedule"
      supervisorOptions={supervisorOptions}
    />,
  );
}

describe("WorkScheduleForm", () => {
  it("uses the requested new-schedule defaults and collision-safe header grid", () => {
    renderForm();

    expect(screen.getByLabelText("Status")).toHaveValue("DRAFT");
    expect(screen.getAllByLabelText("Planned status")).toHaveLength(7);
    expect(screen.getAllByLabelText("Planned status")).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "SCHEDULED" })]),
    );
    screen.getAllByLabelText("Planned status").forEach((field) =>
      expect(field).toHaveValue("SCHEDULED"),
    );
    screen.getAllByLabelText("Actual status").forEach((field) =>
      expect(field).toHaveValue("SCHEDULED"),
    );
    screen.getAllByLabelText("Planned primary").forEach((field) =>
      expect(field).toHaveValue("employee-1"),
    );
    screen.getAllByLabelText("Actual primary").forEach((field) =>
      expect(field).toHaveValue("employee-1"),
    );
    screen.getAllByLabelText("Planned partner").forEach((field) =>
      expect(field).toHaveValue(""),
    );
    screen.getAllByLabelText("Actual partner").forEach((field) =>
      expect(field).toHaveValue(""),
    );
    expect(screen.getByLabelText("Week starting Monday").closest(".work-schedule-header-grid"))
      .toBeInTheDocument();
  });

  it("inherits primary selections until the child is manually overridden", () => {
    renderForm();

    const weeklyPrimary = screen.getByLabelText("Primary employee");
    const plannedPrimary = screen.getAllByLabelText("Planned primary")[0];
    const actualPrimary = screen.getAllByLabelText("Actual primary")[0];

    fireEvent.change(weeklyPrimary, { target: { value: "employee-2" } });
    expect(plannedPrimary).toHaveValue("employee-2");
    expect(actualPrimary).toHaveValue("employee-2");

    fireEvent.change(actualPrimary, { target: { value: "employee-3" } });
    fireEvent.change(plannedPrimary, { target: { value: "employee-1" } });
    expect(actualPrimary).toHaveValue("employee-3");

    fireEvent.change(weeklyPrimary, { target: { value: "employee-2" } });
    expect(plannedPrimary).toHaveValue("employee-1");
    expect(actualPrimary).toHaveValue("employee-3");
  });

  it("mirrors planned partner until actual partner is manually overridden", () => {
    renderForm();

    const plannedPartner = screen.getAllByLabelText("Planned partner")[0];
    const actualPartner = screen.getAllByLabelText("Actual partner")[0];

    fireEvent.change(plannedPartner, { target: { value: "employee-2" } });
    expect(actualPartner).toHaveValue("employee-2");

    fireEvent.change(actualPartner, { target: { value: "employee-3" } });
    fireEvent.change(plannedPartner, { target: { value: "" } });
    expect(actualPartner).toHaveValue("employee-3");
  });

  it("renders legacy free-text identities without silently linking them", () => {
    const initialValues = defaultWorkScheduleInitialValues("2026-08-17", "");
    initialValues.isNew = false;
    initialValues.primaryEmployeeDisplayName = "Legacy Operator";
    initialValues.assignedByDisplayName = "Legacy Supervisor";
    initialValues.assignments[0].plannedPrimaryDisplayName = "Legacy Operator";
    initialValues.assignments[0].plannedPartnerDisplayName = "Legacy Partner";

    renderForm(initialValues);

    expect(screen.getAllByRole("option", { name: "Historical: Legacy Operator (not linked)" }))
      .toHaveLength(2);
    expect(screen.getByRole("option", { name: "Historical: Legacy Supervisor (not linked)" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Historical: Legacy Partner (not linked)" }))
      .toBeInTheDocument();
  });
});
