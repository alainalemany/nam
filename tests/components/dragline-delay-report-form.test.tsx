import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import type { DraglineDelayReportActionState } from "@/features/dragline-delay-reports/validation";

afterEach(cleanup);

const equipmentOptions = [
  {
    id: "dragline-1",
    label: "Dragline 1 #DL-1 · Mine A",
    displayName: "Dragline 1",
    equipmentNumber: "DL-1",
    status: "ACTIVE" as const,
    mineName: "Mine A",
    cityName: "City A",
    cityState: "FL",
  },
];
const employeeOptions = [
  {
    id: "operator-1",
    label: "Alex Operator (100)",
    displayName: "Alex Operator",
    employeeCode: "100",
    isActive: true,
    isSupervisor: false,
  },
  {
    id: "supervisor-1",
    label: "Sam Supervisor (200)",
    displayName: "Sam Supervisor",
    employeeCode: "200",
    isActive: true,
    isSupervisor: true,
  },
];
const initialValues = {
  operationalWorkDate: "2026-08-18",
  shift: "DAY" as const,
  equipmentId: "dragline-1",
  startingHourMeter: "12345",
  endingHourMeter: "",
  supervisorId: "supervisor-1",
  operators: [{ clientId: "operator-row-1", employeeId: "operator-1" }],
  timelineEntries: [],
};

function renderForm(
  action: (
    previousState: DraglineDelayReportActionState,
    formData: FormData,
  ) => Promise<DraglineDelayReportActionState> = vi.fn(async () => ({
    status: "idle" as const,
    message: "",
    fieldErrors: {},
  })),
) {
  return render(
    <DraglineDelayReportForm
      action={action}
      cancelHref="/dragline-delay-reports"
      employeeOptions={employeeOptions}
      equipmentOptions={equipmentOptions}
      initialValues={initialValues}
      submitLabel="Save Draft Report"
      supervisorOptions={employeeOptions.filter((employee) => employee.isSupervisor)}
    />,
  );
}

describe("DraglineDelayReportForm", () => {
  it("provides one searchable, category-grouped official Delay Code control", () => {
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText("Find Delay Code for row 1"), {
      target: { value: "surveying" },
    });
    const select = screen.getByLabelText("Delay Code for row 1");
    expect(within(select).getByRole("option", { name: "26 — Surveying" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: /Startup Check/ })).not.toBeInTheDocument();
    expect(container.querySelector('optgroup[label="OPERATIONAL"]')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "26" } });
    expect(screen.getByText("Category: OPERATIONAL")).toBeInTheDocument();
  });

  it("supports dynamic same-time concurrent rows and an explicit downtime control", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Start time for row 1"), {
      target: { value: "08:30" },
    });
    fireEvent.change(screen.getByLabelText("Delay Code for row 1"), {
      target: { value: "26" },
    });
    fireEvent.change(screen.getByLabelText("Duration for row 1"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByLabelText("Causes machine downtime for row 1"));
    fireEvent.click(screen.getByRole("button", { name: "Add Timeline Row" }));
    fireEvent.change(screen.getByLabelText("Start time for row 2"), {
      target: { value: "08:30" },
    });
    fireEvent.change(screen.getByLabelText("Delay Code for row 2"), {
      target: { value: "34" },
    });
    fireEvent.change(screen.getByLabelText("Description for row 2"), {
      target: { value: "cleaning Motor 2 room" },
    });

    expect(screen.getAllByDisplayValue("08:30")).toHaveLength(2);
    expect(screen.getByLabelText("Causes machine downtime for row 1")).toBeChecked();
    expect(screen.getByLabelText("Causes machine downtime for row 2")).not.toBeChecked();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.getByText("700 min")).toBeInTheDocument();
  });

  it("preserves entered rows when field errors return", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Check the highlighted report fields and try again.",
      fieldErrors: {
        "timelineEntries.0.delayCode": ["Select an official Delay Code from Catalog V1."],
      },
    }));
    renderForm(action);
    fireEvent.change(screen.getByLabelText("Start time for row 1"), {
      target: { value: "08:30" },
    });
    fireEvent.change(screen.getByLabelText("Description for row 1"), {
      target: { value: "preserve this context" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(
      await screen.findByText("Select an official Delay Code from Catalog V1."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Description for row 1")).toHaveValue(
      "preserve this context",
    );
  });

  it("shows a clear stale-write result without replacing local input", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "This Draft was updated elsewhere. Reload it before saving again.",
      fieldErrors: {
        recordVersion: ["This Draft was updated elsewhere. Reload it before saving again."],
      },
    }));
    renderForm(action);
    fireEvent.change(screen.getByLabelText("Starting Hour Meter"), {
      target: { value: "12346" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("updated elsewhere");
    expect(screen.getByLabelText("Starting Hour Meter")).toHaveValue(12346);
  });
});
