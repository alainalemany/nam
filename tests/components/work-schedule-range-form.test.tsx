import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultScheduleRangeInitialValues } from "@/features/work-schedule/data";
import { emptyScheduleRangeFormState } from "@/features/work-schedule/range-state";
import { ScheduleRangeForm } from "@/features/work-schedule/ScheduleRangeForm";

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
});
