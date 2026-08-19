import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";
import type { DraglineDelayReportActionState } from "@/features/dragline-delay-reports/validation";

afterEach(cleanup);

const equipmentOptions = [
  {
    id: "dragline-1",
    mineId: "mine-a",
    label: "Dragline 1 #DL-1 · Mine A",
    displayName: "Dragline 1",
    equipmentNumber: "DL-1",
    status: "ACTIVE" as const,
    mineName: "Mine A",
    cityName: "City A",
    cityState: "FL",
  },
];
const lakeOptions = [
  {
    id: "lake-12",
    mineId: "mine-a",
    name: "Lake 12",
    status: "ACTIVE" as const,
  },
  {
    id: "other-lake",
    mineId: "mine-b",
    name: "Other Mine Lake",
    status: "ACTIVE" as const,
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
  lakeId: "lake-12",
  normalDiggingBuckets: "10",
  benchfillBuckets: "2",
  stationStart: "50+30",
  stationEnd: "50+60",
  depthFeet: "65",
  fuelGallons: "500",
  cableDragFeet: "",
  hoistFeet: "",
  comments: "Draft comment",
  safetyItemsFound: "",
  actionTaken: "",
  operators: [{ clientId: "operator-row-1", employeeId: "operator-1" }],
  timelineEntries: [],
  groundChecks: [],
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
  options: {
    allowComplete?: boolean;
    mode?: "draft" | "correction";
    submitLabel?: string;
  } = {},
) {
  return render(
    <DraglineDelayReportForm
      action={action}
      cancelHref="/dragline-delay-reports"
      employeeOptions={employeeOptions}
      equipmentOptions={equipmentOptions}
      initialValues={initialValues}
      lakeOptions={lakeOptions}
      allowComplete={options.allowComplete}
      mode={options.mode}
      submitLabel={options.submitLabel ?? "Save Draft Report"}
      supervisorOptions={employeeOptions.filter((employee) => employee.isSupervisor)}
    />,
  );
}

describe("DraglineDelayReportForm", () => {
  it("associates required-header errors while preserving the rest of the Draft", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Required or invalid fields need attention. Your entered values were preserved.",
      fieldErrors: { equipmentId: ["Dragline Equipment is required."] },
    }));
    renderForm(action);
    fireEvent.change(screen.getByLabelText("Starting Hour Meter"), {
      target: { value: "12399" },
    });
    expect(screen.getByLabelText("Lake")).toHaveValue("lake-12");
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(await screen.findByText("Dragline Equipment is required.")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Dragline Equipment/ }),
    ).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => {
      expect(screen.getByLabelText("Starting Hour Meter")).toHaveValue(12399);
      expect(
        screen.getByRole("combobox", { name: /Dragline Equipment/ }),
      ).toHaveValue("dragline-1");
      expect(screen.getByLabelText("Lake")).toHaveValue("lake-12");
    });
  });

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
    expect(screen.getAllByText("20 min").length).toBeGreaterThan(0);
    expect(screen.getAllByText("700 min").length).toBeGreaterThan(0);
  });

  it("renders DDR-2 fields, filters Lakes by Mine, and previews absolute Advance", () => {
    renderForm();
    expect(screen.getByLabelText("Lake")).toHaveValue("lake-12");
    expect(screen.getByRole("option", { name: "Lake 12" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Other Mine Lake" })).not.toBeInTheDocument();
    expect(screen.getByText("30 ft")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Station Start"), {
      target: { value: "50+60" },
    });
    fireEvent.change(screen.getByLabelText("Station End"), {
      target: { value: "50+30" },
    });
    expect(screen.getByText("30 ft")).toBeInTheDocument();
  });

  it("supports repeatable Ground Check rows without coupling them to timeline rows", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Add Ground Check" }));
    fireEvent.change(screen.getByLabelText("Ground Check time 1"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ground Check" }));
    fireEvent.change(screen.getByLabelText("Ground Check time 2"), {
      target: { value: "12:00" },
    });
    expect(screen.getByLabelText("Ground Check time 1")).toHaveValue("10:00");
    expect(screen.getByLabelText("Ground Check time 2")).toHaveValue("12:00");
    expect(screen.getAllByText(/Ground Check \d/)).toHaveLength(2);
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
    fireEvent.change(screen.getByLabelText("Normal Digging Buckets"), {
      target: { value: "99" },
    });
    fireEvent.change(screen.getByLabelText("Station End"), {
      target: { value: "bad station" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ground Check" }));
    fireEvent.change(screen.getByLabelText("Ground Check time 1"), {
      target: { value: "10:00" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(
      await screen.findByText("Select an official Delay Code from Catalog V1."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Description for row 1")).toHaveValue(
      "preserve this context",
    );
    expect(screen.getByLabelText("Normal Digging Buckets")).toHaveValue(99);
    expect(screen.getByLabelText("Station End")).toHaveValue("bad station");
    expect(screen.getByLabelText("Ground Check time 1")).toHaveValue("10:00");
  });

  it("preserves dynamic rows when a Ground Check validation error returns", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Required or invalid fields need attention.",
      fieldErrors: {
        "groundChecks.0.startTime": ["Ground Check must start within the Day shift window."],
      },
    }));
    renderForm(action);
    fireEvent.change(screen.getByLabelText("Start time for row 1"), {
      target: { value: "08:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ground Check" }));
    fireEvent.change(screen.getByLabelText("Ground Check time 1"), {
      target: { value: "04:00" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(await screen.findByText(/Ground Check must start/)).toBeInTheDocument();
    expect(screen.getByLabelText("Start time for row 1")).toHaveValue("08:30");
    expect(screen.getByLabelText("Ground Check time 1")).toHaveValue("04:00");
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

  it("shows a top-level persistence error while preserving Draft values", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "The Draft report could not be saved. Review the fields and try again.",
      fieldErrors: {},
    }));
    renderForm(action);
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Keep this after a server error" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Draft Report" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(screen.getByLabelText("Comments")).toHaveValue(
      "Keep this after a server error",
    );
    expect(screen.getByLabelText("Lake")).toHaveValue("lake-12");
  });

  it("offers distinct Save Draft and Complete Report actions", () => {
    renderForm(undefined, { allowComplete: true });
    expect(screen.getByRole("button", { name: "Save Draft Report" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Report" })).toBeInTheDocument();
  });

  it("preserves complete form state when Ending Hour Meter blocks completion", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Cannot complete report yet. Required or invalid fields need attention. Your entered values were preserved.",
      fieldErrors: {
        endingHourMeter: ["Ending Hour Meter is required to complete the report."],
      },
    }));
    renderForm(action, { allowComplete: true });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Preserve completion notes" },
    });
    fireEvent.change(screen.getByLabelText("Start time for row 1"), {
      target: { value: "16:59" },
    });
    fireEvent.change(screen.getByLabelText("Delay Code for row 1"), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ground Check" }));
    fireEvent.change(screen.getByLabelText("Ground Check time 1"), {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Report" }));

    expect(await screen.findByText(/Ending Hour Meter is required/)).toBeInTheDocument();
    expect(screen.getByLabelText("Comments")).toHaveValue("Preserve completion notes");
    expect(screen.getByLabelText("Delay Code for row 1")).toHaveValue("13");
    expect(screen.getByLabelText("Ground Check time 1")).toHaveValue("10:00");
    expect(screen.getByLabelText("Lake")).toHaveValue("lake-12");
  });

  it("preserves all rows when Supervisor or final Shift Change validation fails", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Cannot complete report yet.",
      fieldErrors: {
        supervisorId: ["Supervisor is required to complete the report."],
        timelineEntries: ["Final timeline entry must be 13 — Shift Change."],
      },
    }));
    renderForm(action, { allowComplete: true });
    fireEvent.change(screen.getByLabelText("Supervisor"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Start time for row 1"), {
      target: { value: "16:59" },
    });
    fireEvent.change(screen.getByLabelText("Delay Code for row 1"), {
      target: { value: "34" },
    });
    fireEvent.change(screen.getByLabelText("Safety Items Found"), {
      target: { value: "Preserve safety observation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Report" }));

    expect(await screen.findByText(/Supervisor is required/)).toBeInTheDocument();
    expect(screen.getByText("Final timeline entry must be 13 — Shift Change.")).toBeInTheDocument();
    expect(screen.getByLabelText("Delay Code for row 1")).toHaveValue("34");
    expect(screen.getByLabelText("Safety Items Found")).toHaveValue(
      "Preserve safety observation",
    );
  });

  it("preserves invalid station input and unsaved rows on failed completion", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Cannot complete report yet.",
      fieldErrors: { stationEnd: ["Station must use notation such as 50+30."] },
    }));
    renderForm(action, { allowComplete: true });
    fireEvent.change(screen.getByLabelText("Station End"), {
      target: { value: "invalid" },
    });
    fireEvent.change(screen.getByLabelText("Normal Digging Buckets"), {
      target: { value: "77" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Report" }));

    expect(await screen.findByText(/Station must use notation/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Station End/)).toHaveValue("invalid");
    expect(screen.getByLabelText("Normal Digging Buckets")).toHaveValue(77);
  });

  it("shows stale completion without discarding unsaved values", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "This report changed elsewhere; reload before completing.",
      fieldErrors: {
        recordVersion: ["This report changed elsewhere; reload before completing."],
      },
    }));
    renderForm(action, { allowComplete: true });
    fireEvent.change(screen.getByLabelText(/Ending Hour Meter/), {
      target: { value: "12356" },
    });
    fireEvent.change(screen.getByLabelText("Action Taken"), {
      target: { value: "Preserve stale completion edits" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete Report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByLabelText(/Ending Hour Meter/)).toHaveValue(12356);
    expect(screen.getByLabelText("Action Taken")).toHaveValue(
      "Preserve stale completion edits",
    );
  });

  it("requires a Correction Reason while preserving corrected values", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "Cannot correct report yet.",
      fieldErrors: { correctionReason: ["Correction Reason is required."] },
    }));
    renderForm(action, {
      mode: "correction",
      submitLabel: "Save Corrected Report",
    });
    fireEvent.change(screen.getByLabelText("Fuel (gallons)"), {
      target: { value: "525" },
    });
    fireEvent.change(screen.getByLabelText("Comments"), {
      target: { value: "Corrected report comment" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Corrected Report" }).closest("form")!);

    expect(await screen.findByText("Correction Reason is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Fuel (gallons)")).toHaveValue(525);
    expect(screen.getByLabelText("Comments")).toHaveValue("Corrected report comment");
  });

  it("preserves the Correction Reason and edits after a stale correction", async () => {
    const action = vi.fn(async () => ({
      status: "error" as const,
      message: "This report changed elsewhere; reload before saving the correction.",
      fieldErrors: {
        recordVersion: ["This report changed elsewhere; reload before saving the correction."],
      },
    }));
    renderForm(action, {
      mode: "correction",
      submitLabel: "Save Corrected Report",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Correction Reason" }), {
      target: { value: "Corrected meter from signed shift paperwork." },
    });
    fireEvent.change(screen.getByLabelText(/Ending Hour Meter/), {
      target: { value: "12358" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save Corrected Report" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("changed elsewhere");
    expect(screen.getByRole("textbox", { name: "Correction Reason" })).toHaveValue(
      "Corrected meter from signed shift paperwork.",
    );
    expect(screen.getByLabelText(/Ending Hour Meter/)).toHaveValue(12358);
  });
});
