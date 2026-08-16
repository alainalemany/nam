import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const equipmentOptions = [
  { id: "equipment-1", label: "Dragline 7" },
  { id: "equipment-2", label: "Dragline 9" },
];

function renderForm(
  initialValues = defaultWorkScheduleInitialValues("2026-08-17", "employee-1"),
  formAction = action,
) {
  return render(
    <WorkScheduleForm
      action={formAction}
      cancelHref="/work-schedule"
      employeeOptions={employeeOptions}
      equipmentOptions={equipmentOptions}
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

  it("mirrors planned shift and equipment until each actual field is manually overridden", () => {
    renderForm();

    const plannedShift = screen.getAllByLabelText("Planned shift")[0];
    const actualShift = screen.getAllByLabelText("Actual shift")[0];
    const plannedEquipment = screen.getAllByLabelText("Planned equipment")[0];
    const actualEquipment = screen.getAllByLabelText("Actual equipment")[0];

    fireEvent.change(plannedShift, { target: { value: "DAY" } });
    fireEvent.change(plannedEquipment, { target: { value: "equipment-1" } });
    expect(actualShift).toHaveValue("DAY");
    expect(actualEquipment).toHaveValue("equipment-1");

    fireEvent.change(actualShift, { target: { value: "NIGHT" } });
    fireEvent.change(actualEquipment, { target: { value: "equipment-2" } });
    fireEvent.change(plannedShift, { target: { value: "SWING" } });
    fireEvent.change(plannedEquipment, { target: { value: "" } });
    expect(actualShift).toHaveValue("NIGHT");
    expect(actualEquipment).toHaveValue("equipment-2");
  });

  it("makes a non-working day strongly inactive, clears it, and restores it", () => {
    renderForm();
    const monday = screen.getByRole("group", { name: /Monday/ });
    const plannedStatus = screen.getAllByLabelText("Planned status")[0];

    fireEvent.change(screen.getAllByLabelText("Planned shift")[0], { target: { value: "DAY" } });
    fireEvent.change(screen.getAllByLabelText("Planned equipment")[0], { target: { value: "equipment-1" } });
    fireEvent.change(screen.getAllByLabelText("Planned partner")[0], { target: { value: "employee-2" } });
    fireEvent.change(screen.getAllByLabelText("Planned notes")[0], { target: { value: "Original note" } });
    fireEvent.change(plannedStatus, { target: { value: "NON_WORKING" } });

    expect(monday).toHaveClass("work-schedule-day--inactive", "work-schedule-day--non-working");
    expect(screen.getByText("Non-working", { selector: ".work-schedule-day-status-badge" })).toBeVisible();
    expect(screen.getAllByLabelText("Actual status")[0]).toHaveValue("NON_WORKING");
    expect(screen.getAllByLabelText("Actual status")[0]).toBeDisabled();
    expect(screen.getAllByLabelText("Planned shift")[0]).toHaveValue("UNKNOWN");
    expect(screen.getAllByLabelText("Planned equipment")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Planned primary")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Planned partner")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Change reason")[0]).toBeDisabled();
    expect(screen.getAllByLabelText("Planned notes")[0]).toBeDisabled();

    fireEvent.change(plannedStatus, { target: { value: "SCHEDULED" } });
    expect(monday).not.toHaveClass("work-schedule-day--inactive");
    expect(screen.getAllByLabelText("Planned shift")[0]).toBeEnabled();
    expect(screen.getAllByLabelText("Actual status")[0]).toHaveValue("SCHEDULED");
  });

  it("makes a cancelled day inactive while preserving planned history and Change Reason", () => {
    renderForm();
    const monday = screen.getByRole("group", { name: /Monday/ });
    const plannedStatus = screen.getAllByLabelText("Planned status")[0];
    fireEvent.change(screen.getAllByLabelText("Planned shift")[0], { target: { value: "DAY" } });
    fireEvent.change(screen.getAllByLabelText("Planned equipment")[0], { target: { value: "equipment-1" } });
    fireEvent.change(screen.getAllByLabelText("Planned primary")[0], { target: { value: "employee-2" } });
    fireEvent.change(screen.getAllByLabelText("Planned partner")[0], { target: { value: "employee-3" } });
    fireEvent.change(screen.getAllByLabelText("Planned notes")[0], { target: { value: "Originally scheduled" } });
    fireEvent.change(plannedStatus, { target: { value: "CANCELLED" } });

    expect(monday).toHaveClass("work-schedule-day--inactive", "work-schedule-day--cancelled");
    expect(screen.getByText("Cancelled", { selector: ".work-schedule-day-status-badge" })).toBeVisible();
    expect(screen.getAllByLabelText("Planned shift")[0]).toHaveValue("DAY");
    expect(screen.getAllByLabelText("Planned equipment")[0]).toHaveValue("equipment-1");
    expect(screen.getAllByLabelText("Planned primary")[0]).toHaveValue("employee-2");
    expect(screen.getAllByLabelText("Planned partner")[0]).toHaveValue("employee-3");
    expect(screen.getAllByLabelText("Planned notes")[0]).toHaveValue("Originally scheduled");
    expect(screen.getAllByLabelText("Planned shift")[0]).toBeDisabled();
    expect(screen.getAllByLabelText("Actual shift")[0]).toBeDisabled();
    expect(screen.getAllByLabelText("Actual equipment")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Actual primary")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Actual partner")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Actual notes")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("Change reason")[0]).toBeEnabled();

    fireEvent.change(screen.getAllByLabelText("Change reason")[0], { target: { value: "Weather" } });
    fireEvent.change(plannedStatus, { target: { value: "SCHEDULED" } });
    expect(monday).not.toHaveClass("work-schedule-day--inactive");
    expect(screen.getAllByLabelText("Planned shift")[0]).toBeEnabled();
    expect(screen.getAllByLabelText("Actual shift")[0]).toHaveValue("DAY");
  });

  it("does not apply new-record inheritance to stored edit values", () => {
    const initialValues = defaultWorkScheduleInitialValues("2026-08-17", "employee-1");
    initialValues.isNew = false;
    Object.assign(initialValues.assignments[0], {
      plannedShift: "DAY",
      actualShift: "NIGHT",
      plannedEquipmentId: "equipment-1",
      actualEquipmentId: "equipment-2",
    });
    renderForm(initialValues);

    fireEvent.change(screen.getAllByLabelText("Planned shift")[0], { target: { value: "SWING" } });
    fireEvent.change(screen.getAllByLabelText("Planned equipment")[0], { target: { value: "" } });
    expect(screen.getAllByLabelText("Actual shift")[0]).toHaveValue("NIGHT");
    expect(screen.getAllByLabelText("Actual equipment")[0]).toHaveValue("equipment-2");
  });

  it("rehydrates every weekly and daily value and exposes the field error after validation", async () => {
    const validationAction = vi.fn(async (_state, formData: FormData) => ({
      status: "error" as const,
      message: "Check the highlighted fields and try again.",
      fieldErrors: { scheduleNotes: ["Schedule notes are invalid."] },
      assignmentErrors: { 0: { actualShift: ["Monday Actual Shift is required."] } },
      submittedValues: {
        weekStartDate: String(formData.get("weekStartDate")),
        status: String(formData.get("status")),
        primaryEmployeeId: String(formData.get("primaryEmployeeId")),
        assignedByEmployeeId: String(formData.get("assignedByEmployeeId")),
        receivedAt: String(formData.get("receivedAt")),
        sourceNote: String(formData.get("sourceNote")),
        scheduleNotes: String(formData.get("scheduleNotes")),
        assignments: Array.from({ length: 7 }, (_, index) => ({
          assignmentDate: formData.getAll("assignmentDate")[index] as string,
          dayOfWeek: formData.getAll("dayOfWeek")[index] as string,
          plannedStatus: formData.getAll("plannedStatus")[index] as string,
          plannedShift: formData.getAll("plannedShift")[index] as string,
          plannedEquipmentId: index === 0 ? "equipment-1" : formData.getAll("plannedEquipmentId")[index] as string,
          actualStatus: formData.getAll("actualStatus")[index] as string,
          actualShift: formData.getAll("actualShift")[index] as string,
          actualEquipmentId: formData.getAll("actualEquipmentId")[index] as string,
          plannedPrimaryEmployeeId: formData.getAll("plannedPrimaryEmployeeId")[index] as string,
          plannedPartnerEmployeeId: formData.getAll("plannedPartnerEmployeeId")[index] as string,
          plannedPartnerUnknown: formData.has(`plannedPartnerUnknown-${index}`),
          actualPrimaryEmployeeId: formData.getAll("actualPrimaryEmployeeId")[index] as string,
          actualPartnerEmployeeId: formData.getAll("actualPartnerEmployeeId")[index] as string,
          actualPartnerUnknown: formData.has(`actualPartnerUnknown-${index}`),
          changeReason: formData.getAll("changeReason")[index] as string,
          plannedNotes: formData.getAll("plannedNotes")[index] as string,
          actualNotes: formData.getAll("actualNotes")[index] as string,
        })),
      },
    }));
    renderForm(defaultWorkScheduleInitialValues("2026-08-17", "employee-1"), validationAction);

    fireEvent.change(screen.getByLabelText("Assigned By"), { target: { value: "supervisor-1" } });
    fireEvent.change(screen.getByLabelText("Received at"), { target: { value: "2026-08-16T15:30" } });
    fireEvent.change(screen.getByLabelText("Source note"), { target: { value: "SMS source" } });
    fireEvent.change(screen.getByLabelText("Schedule notes"), { target: { value: "Weekly note" } });
    fireEvent.change(screen.getAllByLabelText("Planned shift")[0], { target: { value: "DAY" } });
    fireEvent.change(screen.getAllByLabelText("Planned equipment")[0], { target: { value: "equipment-1" } });
    fireEvent.change(screen.getAllByLabelText("Planned partner")[0], { target: { value: "employee-2" } });
    fireEvent.click(screen.getAllByLabelText("Planned partner unknown")[1]);
    fireEvent.change(screen.getAllByLabelText("Change reason")[0], { target: { value: "Changed" } });
    fireEvent.change(screen.getAllByLabelText("Planned notes")[0], { target: { value: "Plan" } });
    fireEvent.change(screen.getAllByLabelText("Actual notes")[0], { target: { value: "Actual" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save Work Schedule" }).closest("form")!);

    await waitFor(
      () => expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields"),
      { timeout: 5000 },
    );
    expect(screen.getByLabelText("Assigned By")).toHaveValue("supervisor-1");
    expect(screen.getByLabelText("Received at")).toHaveValue("2026-08-16T15:30");
    expect(screen.getByLabelText("Source note")).toHaveValue("SMS source");
    expect(screen.getByLabelText("Schedule notes")).toHaveValue("Weekly note");
    expect(screen.getAllByLabelText("Planned shift")[0]).toHaveValue("DAY");
    await waitFor(
      () => expect(screen.getAllByLabelText("Planned equipment")[0]).toHaveValue("equipment-1"),
      { timeout: 5000 },
    );
    expect(screen.getAllByLabelText("Planned partner")[0]).toHaveValue("employee-2");
    expect(screen.getAllByLabelText("Planned partner unknown")[1]).toBeChecked();
    expect(screen.getAllByLabelText("Change reason")[0]).toHaveValue("Changed");
    expect(screen.getAllByLabelText("Planned notes")[0]).toHaveValue("Plan");
    expect(screen.getAllByLabelText("Actual notes")[0]).toHaveValue("Actual");
    const actualShiftError = screen.getByText("Monday Actual Shift is required.");
    expect(actualShiftError).toBeVisible();
    expect(actualShiftError.closest("label")?.querySelector("select")).toHaveAttribute("aria-invalid", "true");
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
