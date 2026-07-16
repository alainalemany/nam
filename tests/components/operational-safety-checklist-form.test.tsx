import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationalSafetyChecklistForm } from "@/features/operational-safety-checklists/OperationalSafetyChecklistForm";
import { getSafetyChecklistTemplate } from "@/features/operational-safety-checklists/templates";

afterEach(cleanup);

const action = vi.fn(async () => ({ status: "idle" as const, message: "", fieldErrors: {} }));
const equipmentOptions = [
  {
    id: "dragline-1",
    label: "Dragline 1 #DL-1 (Mine A)",
    displayName: "Dragline 1",
    equipmentNumber: "DL-1",
    category: "DRAGLINE" as const,
    mineName: "Mine A",
    cityName: "City A",
    cityState: "FL",
    templateKey: "DRAGLINE_INSPECTION" as const,
    templateVersion: 1,
    templateName: "Dragline Inspection",
  },
  {
    id: "truck-1",
    label: "Truck 1 #WT-1 (Mine A)",
    displayName: "Truck 1",
    equipmentNumber: "WT-1",
    category: "WORK_TRUCK" as const,
    mineName: "Mine A",
    cityName: "City A",
    cityState: "FL",
    templateKey: "MOBILE_INSPECTION" as const,
    templateVersion: 1,
    templateName: "Mobile Inspection",
  },
  {
    id: "dragline-2",
    label: "Dragline 2 #DL-2 (Mine B)",
    displayName: "Dragline 2",
    equipmentNumber: "DL-2",
    category: "DRAGLINE" as const,
    mineName: "Mine B",
    cityName: "City B",
    cityState: "WY",
    templateKey: "DRAGLINE_INSPECTION" as const,
    templateVersion: 1,
    templateName: "Dragline Inspection",
  },
  {
    id: "truck-2",
    label: "Truck 2 #WT-2 (Mine B)",
    displayName: "Truck 2",
    equipmentNumber: "WT-2",
    category: "WORK_TRUCK" as const,
    mineName: "Mine B",
    cityName: "City B",
    cityState: "WY",
    templateKey: "MOBILE_INSPECTION" as const,
    templateVersion: 1,
    templateName: "Mobile Inspection",
  },
];

describe("OperationalSafetyChecklistForm", () => {
  it("resolves the Dragline template from Equipment without Planner Review", () => {
    render(<OperationalSafetyChecklistForm action={action} cancelHref="/" equipmentOptions={equipmentOptions} submitLabel="Submit" />);
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "dragline-1" } });
    expect(screen.getByRole("heading", { name: "Dragline Inspection" })).toBeInTheDocument();
    expect(screen.getByText("Bench Condition")).toBeInTheDocument();
    expect(screen.getByText("Two Life Jackets In Cabin")).toBeInTheDocument();
    expect(screen.queryByText("Planner Review")).not.toBeInTheDocument();
  });

  it("switches to the canonical Mobile template and derives Mine and City", () => {
    render(<OperationalSafetyChecklistForm action={action} cancelHref="/" equipmentOptions={equipmentOptions} submitLabel="Submit" />);
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "truck-1" } });
    expect(screen.getByRole("heading", { name: "Mobile Inspection" })).toBeInTheDocument();
    expect(screen.getByText("Rental")).toBeInTheDocument();
    expect(screen.getByText("Fire Supression System")).toBeInTheDocument();
    expect(screen.getByText("Fuel Card")).toBeInTheDocument();
    expect(screen.getByText("Mine A")).toBeInTheDocument();
    expect(screen.getByText("City A, FL")).toBeInTheDocument();
  });

  it("filters the Equipment selector by name, number, or mine", () => {
    render(<OperationalSafetyChecklistForm action={action} cancelHref="/" equipmentOptions={equipmentOptions} submitLabel="Submit" />);
    fireEvent.change(screen.getByLabelText("Find Equipment"), {
      target: { value: "WT-1" },
    });
    expect(screen.getByRole("option", { name: "Truck 1 #WT-1 (Mine A)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Dragline 1 #DL-1 (Mine A)" })).not.toBeInTheDocument();
  });

  it.each([
    ["dragline-1", "dragline-2", "Bench Condition", "OK", 24],
    ["truck-1", "truck-2", "Rental", "YES", 23],
    ["dragline-1", "truck-1", "Bench Condition", "OK", 23],
    ["truck-1", "dragline-1", "Rental", "YES", 24],
  ])(
    "clears machine-specific state when Equipment changes from %s to %s",
    (sourceId, destinationId, responseLabel, responseValue, destinationCount) => {
    render(<OperationalSafetyChecklistForm action={action} cancelHref="/" equipmentOptions={equipmentOptions} submitLabel="Submit" />);
      fireEvent.change(screen.getByLabelText("Inspection date"), {
        target: { value: "2026-07-14" },
      });
      fireEvent.change(screen.getByLabelText("Shift"), { target: { value: "NIGHT" } });
      fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "Alex" } });
      fireEvent.change(screen.getByLabelText("Supervisor"), { target: { value: "Sam" } });
      fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: sourceId } });
      fireEvent.change(screen.getByLabelText("Hour Meter (Start)"), {
        target: { value: "456" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "Problem Description(s)" }), {
        target: { value: "Context for the first machine." },
      });
      const sourceField = screen.getByText(responseLabel).closest("fieldset")!;
      fireEvent.click(
        sourceField.querySelector(`input[value="${responseValue}"]`) as HTMLInputElement,
      );

      fireEvent.change(screen.getByLabelText("Equipment"), {
        target: { value: destinationId },
      });

      expect(screen.getByText(`0 of ${destinationCount}`)).toBeInTheDocument();
      expect(screen.getByLabelText("Hour Meter (Start)")).toHaveValue(null);
      expect(screen.getByRole("textbox", { name: "Problem Description(s)" })).toHaveValue("");
      expect(screen.getByLabelText("Inspection date")).toHaveValue("2026-07-14");
      expect(screen.getByLabelText("Shift")).toHaveValue("NIGHT");
      expect(screen.getByLabelText("Operator")).toHaveValue("Alex");
      expect(screen.getByLabelText("Supervisor")).toHaveValue("Sam");
    },
  );

  it("preserves existing responses when correction Equipment is unchanged", () => {
    render(
      <OperationalSafetyChecklistForm
        action={action}
        cancelHref="/"
        equipmentOptions={equipmentOptions}
        initialValues={{
          inspectionDate: "2026-07-15",
          shift: "DAY",
          equipmentId: "dragline-1",
          templateKey: "DRAGLINE_INSPECTION",
          templateVersion: 1,
          startingMeter: "123",
          operatorDisplayName: "Alex",
          supervisorDisplayName: "Sam",
          problemDescription: "Existing context",
          responses: { bench_condition: "OK" },
        }}
        submitLabel="Save Correction"
      />,
    );

    const benchField = screen.getByText("Bench Condition").closest("fieldset")!;
    expect(benchField.querySelector('input[value="OK"]')).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Problem Description(s)" })).toHaveValue(
      "Existing context",
    );
  });

  it("requires intentional replacement when historical Equipment is unavailable", () => {
    render(
      <OperationalSafetyChecklistForm
        action={action}
        cancelHref="/"
        equipmentOptions={equipmentOptions}
        initialValues={{
          inspectionDate: "2026-07-15",
          shift: "DAY",
          equipmentId: "",
          templateKey: "DRAGLINE_INSPECTION",
          templateVersion: 1,
          startingMeter: "123",
          operatorDisplayName: "Alex",
          supervisorDisplayName: "Sam",
          problemDescription: "Historic problem",
          responses: { bench_condition: "NEEDS_REPAIR" },
        }}
        submitLabel="Save Correction"
        unavailableEquipmentLabel="Deleted Dragline #DL-OLD"
      />,
    );

    expect(screen.getByText(/Original Equipment unavailable/)).toHaveTextContent(
      "Deleted Dragline #DL-OLD",
    );
    expect(screen.getByRole("button", { name: "Save Correction" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Equipment"), {
      target: { value: "dragline-2" },
    });
    expect(screen.getByText("0 of 24")).toBeInTheDocument();
    expect(screen.getByLabelText("Hour Meter (Start)")).toHaveValue(null);
    expect(screen.getByRole("textbox", { name: "Problem Description(s)" })).toHaveValue("");
    expect(screen.getByLabelText("Inspection date")).toHaveValue("2026-07-15");
    expect(screen.getByLabelText("Operator")).toHaveValue("Alex");
    expect(screen.getByLabelText("Supervisor")).toHaveValue("Sam");
  });

  it("renders server item errors beside the exact response", async () => {
    const failingAction = vi.fn(async () => ({
      status: "error" as const,
      message: "Check the highlighted checklist fields and try again.",
      fieldErrors: { "responses.bench_condition": ["Bench Condition requires a response."] },
    }));
    const template = getSafetyChecklistTemplate("DRAGLINE_INSPECTION", 1)!;
    render(
      <OperationalSafetyChecklistForm
        action={failingAction}
        cancelHref="/"
        equipmentOptions={equipmentOptions}
        initialValues={{
          inspectionDate: "2026-07-15",
          shift: "DAY",
          equipmentId: "dragline-1",
          templateKey: "DRAGLINE_INSPECTION",
          templateVersion: 1,
          startingMeter: "100",
          operatorDisplayName: "Alex Operator",
          supervisorDisplayName: "Sam Supervisor",
          problemDescription: "",
          responses: Object.fromEntries(
            template.fields.map((field) => [
              field.key,
              field.responseSet === "YES_NO" ? "YES" : "OK",
            ]),
          ),
        }}
        submitLabel="Submit"
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Submit" }).closest("form")!);
    const benchField = screen.getByText("Bench Condition").closest("fieldset")!;
    expect(await screen.findByText("Bench Condition requires a response.")).toBeInTheDocument();
    expect(benchField).toContainElement(
      screen.getByText("Bench Condition requires a response."),
    );
  });
});
