import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSuggestions: vi.fn() }));
vi.mock("@/features/equipment-fuel-events/actions", () => ({
  getEquipmentFuelTankLabelSuggestionsAction: mocks.loadSuggestions,
}));

import { EquipmentFuelEventForm } from "@/features/equipment-fuel-events/EquipmentFuelEventForm";
import type { EquipmentFuelActionState } from "@/features/equipment-fuel-events/validation";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadSuggestions.mockResolvedValue([]);
});

const action = vi.fn(async (): Promise<EquipmentFuelActionState> => ({ status: "idle", message: "", fieldErrors: {} }));
const equipmentOptions = [
  { id: "diesel-1", label: "Dragline 1 #DL-1 · Mine A", displayName: "Dragline 1", equipmentNumber: "DL-1", category: "DRAGLINE" as const, powerType: "DIESEL" as const, status: "ACTIVE" as const, mineName: "Mine A", cityName: "City A", cityState: "FL" },
  { id: "diesel-2", label: "Tractor 2 #TR-2 · Mine B", displayName: "Tractor 2", equipmentNumber: "TR-2", category: "TRACTOR" as const, powerType: "DIESEL" as const, status: "ACTIVE" as const, mineName: "Mine B", cityName: "City B", cityState: "WY" },
  { id: "gas-1", label: "Truck 1 #WT-1 · Mine A", displayName: "Truck 1", equipmentNumber: "WT-1", category: "WORK_TRUCK" as const, powerType: "GASOLINE" as const, status: "ACTIVE" as const, mineName: "Mine A", cityName: "City A", cityState: "FL" },
];
const gasStationOptions = [
  { id: "station-1", label: "Wawa · 123 Main St · Hialeah, FL · 33010", name: "Wawa", address: "123 Main St", cityName: "Hialeah", cityState: "FL", postalCode: "33010", isActive: true },
  { id: "station-2", label: "Shell · 500 West Ave · Miami, FL", name: "Shell", address: "500 West Ave", cityName: "Miami", cityState: "FL", postalCode: null, isActive: true },
];
const initialValues = {
  operationalWorkDate: "2026-07-15",
  eventTime: "08:15",
  equipmentId: "diesel-1",
  fuelType: "DIESEL" as const,
  gasStationId: "station-1",
  pricePerGallon: "3.457",
  meterType: "HOURS" as const,
  meterReading: "1204.5",
  receiptReference: "R-100",
  notes: "Preserved event note",
  tankFills: [
    { sequence: 1, tankLabel: "Main Tank", gallons: "390" },
    { sequence: 2, tankLabel: "Walking Engine", gallons: "79" },
  ],
};
const baseProps = {
  action,
  cancelHref: "/",
  equipmentOptions,
  gasStationOptions,
  initialTankLabelSuggestions: ["Main Tank", "Walking Engine"],
  submitLabel: "Save Fuel Event",
};

function submittedValues(formData: FormData) {
  return JSON.parse(String(formData.get("payload")));
}

function rowIds(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(".fuel-fill-row")].map((row) => row.dataset.clientRowId);
}

describe("EquipmentFuelEventForm", () => {
  it("filters Equipment and Gas Station choices without presenting Equipment assignment as fueling location", () => {
    render(<EquipmentFuelEventForm {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Find Equipment"), { target: { value: "DL-1" } });
    expect(screen.getByRole("option", { name: "Dragline 1 #DL-1 · Mine A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Truck 1 #WT-1 · Mine A" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-1" } });
    expect(screen.getByText("Dragline 1 #DL-1 · Mine A", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gasoline" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Find Gas Station"), { target: { value: "Wawa" } });
    expect(screen.getByRole("option", { name: gasStationOptions[0].label })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: gasStationOptions[1].label })).not.toBeInTheDocument();
  });

  it("keeps stable client row identity through add, moves, remove, and failed submit", async () => {
    const failedAction = vi.fn(async (_state: EquipmentFuelActionState, formData: FormData) => ({
      status: "error" as const,
      message: "The Fuel Event could not be saved.",
      fieldErrors: {},
      values: submittedValues(formData),
    }));
    const { container } = render(<EquipmentFuelEventForm {...baseProps} action={failedAction} />);
    const firstId = rowIds(container)[0];
    fireEvent.click(screen.getByRole("button", { name: "Add Tank Fill" }));
    const secondId = rowIds(container)[1];
    expect(secondId).not.toBe(firstId);
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[1]).getByRole("button", { name: "Move up" }));
    expect(rowIds(container)).toEqual([secondId, firstId]);
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[0]).getByRole("button", { name: "Move down" }));
    expect(rowIds(container)).toEqual([firstId, secondId]);
    fireEvent.click(screen.getByRole("button", { name: "Add Tank Fill" }));
    const thirdId = rowIds(container)[2];
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[1]).getByRole("button", { name: "Remove" }));
    expect(rowIds(container)).toEqual([firstId, thirdId]);
    fireEvent.submit(screen.getByRole("button", { name: "Save Fuel Event" }).closest("form")!);
    await screen.findByText("The Fuel Event could not be saved.");
    expect(rowIds(container)).toEqual([firstId, thirdId]);
    const payload = submittedValues(failedAction.mock.calls[0][1]);
    expect(payload.tankFills.map((fill: { sequence: number }) => fill.sequence)).toEqual([1, 2]);
  });

  it("restores the complete raw aggregate and row order after Tank Label validation fails", async () => {
    const invalidLabelAction = vi.fn(async (_state: EquipmentFuelActionState, formData: FormData) => ({
      status: "error" as const,
      message: "Check the highlighted Fuel Event fields and try again.",
      fieldErrors: { "tankFills.0.tankLabel": ["Tank label is required."] },
      values: submittedValues(formData),
    }));
    const { container } = render(<EquipmentFuelEventForm {...baseProps} action={invalidLabelAction} initialValues={initialValues} />);
    fireEvent.change(screen.getByLabelText("Operational work date"), { target: { value: "2026-07-16" } });
    fireEvent.change(screen.getByLabelText("Local event time"), { target: { value: "09:35" } });
    fireEvent.change(screen.getByLabelText("Fuel type"), { target: { value: "OFF_ROAD_DIESEL" } });
    fireEvent.change(screen.getByLabelText("Gas Station"), { target: { value: "station-2" } });
    fireEvent.change(screen.getByLabelText("Price per gallon"), { target: { value: "4.129" } });
    fireEvent.change(screen.getByLabelText("Meter type"), { target: { value: "ODOMETER" } });
    fireEvent.change(screen.getByLabelText("Meter reading"), { target: { value: "4500.125" } });
    fireEvent.change(screen.getByLabelText("Receipt number/reference (optional)"), { target: { value: "R-RAW-22" } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Keep every raw value" } });
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[1]).getByRole("button", { name: "Move up" }));
    fireEvent.change(screen.getAllByLabelText("Tank label")[0], { target: { value: "" } });
    fireEvent.change(screen.getAllByLabelText("Delivered gallons")[0], { target: { value: "79.347" } });
    const idsBeforeSubmit = rowIds(container);
    fireEvent.submit(screen.getByRole("button", { name: "Save Fuel Event" }).closest("form")!);
    const error = await screen.findByText("Tank label is required.");
    expect(submittedValues(invalidLabelAction.mock.calls[0][1]).tankFills).toHaveLength(2);
    await waitFor(() => expect(screen.getByLabelText("Equipment")).toHaveValue("diesel-1"));
    await waitFor(() => expect(screen.getAllByLabelText("Tank label")).toHaveLength(2));
    expect(screen.getByLabelText("Operational work date")).toHaveValue("2026-07-16");
    expect(screen.getByLabelText("Local event time")).toHaveValue("09:35");
    expect(screen.getByLabelText("Fuel type")).toHaveValue("OFF_ROAD_DIESEL");
    expect(screen.getByLabelText("Gas Station")).toHaveValue("station-2");
    expect(screen.getByLabelText("Price per gallon")).toHaveValue(4.129);
    expect(screen.getByLabelText("Meter type")).toHaveValue("ODOMETER");
    expect(screen.getByLabelText("Meter reading")).toHaveValue(4500.125);
    expect(screen.getByLabelText("Receipt number/reference (optional)")).toHaveValue("R-RAW-22");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Keep every raw value");
    const restoredRows = screen.getAllByRole("group", { name: /Tank Fill/ });
    expect(within(restoredRows[0]).getByLabelText("Tank label")).toHaveValue("");
    expect(within(restoredRows[0]).getByLabelText("Delivered gallons")).toHaveValue(79.347);
    expect(within(restoredRows[1]).getByLabelText("Tank label")).toHaveValue("Main Tank");
    expect(within(restoredRows[1]).getByLabelText("Delivered gallons")).toHaveValue(390);
    expect(rowIds(container)).toEqual(idsBeforeSubmit);
    expect(within(restoredRows[0]).getByLabelText("Tank label")).toHaveAttribute("aria-invalid", "true");
    expect(within(restoredRows[0]).getByLabelText("Tank label")).toHaveAttribute("aria-describedby", error.id);
    expect(within(restoredRows[1]).getByLabelText("Tank label")).not.toHaveAttribute("aria-invalid");
  });

  it("restores the complete aggregate after a recoverable persistence failure", async () => {
    const failedAction = vi.fn(async (_state: EquipmentFuelActionState, formData: FormData) => ({
      status: "error" as const,
      message: "The Fuel Event could not be saved. Review the fields and try again.",
      fieldErrors: {},
      values: submittedValues(formData),
    }));
    render(<EquipmentFuelEventForm {...baseProps} action={failedAction} initialValues={initialValues} />);
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Persistence retry" } });
    fireEvent.change(screen.getByLabelText("Price per gallon"), { target: { value: "3.999" } });
    fireEvent.change(screen.getByLabelText("Meter reading"), { target: { value: "1205.125" } });
    fireEvent.change(screen.getByLabelText("Receipt number/reference (optional)"), { target: { value: "R-RETRY" } });
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[1]).getByRole("button", { name: "Move up" }));
    fireEvent.submit(screen.getByRole("button", { name: "Save Fuel Event" }).closest("form")!);
    await screen.findByText("The Fuel Event could not be saved. Review the fields and try again.");
    await waitFor(() => expect(screen.getByLabelText("Equipment")).toHaveValue("diesel-1"));
    expect(screen.getByLabelText("Operational work date")).toHaveValue("2026-07-15");
    expect(screen.getByLabelText("Local event time")).toHaveValue("08:15");
    expect(screen.getByLabelText("Fuel type")).toHaveValue("DIESEL");
    expect(screen.getByLabelText("Gas Station")).toHaveValue("station-1");
    expect(screen.getByLabelText("Price per gallon")).toHaveValue(3.999);
    expect(screen.getByLabelText("Meter type")).toHaveValue("HOURS");
    expect(screen.getByLabelText("Meter reading")).toHaveValue(1205.125);
    expect(screen.getByLabelText("Receipt number/reference (optional)")).toHaveValue("R-RETRY");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Persistence retry");
    expect(screen.getAllByLabelText("Tank label").map((input) => (input as HTMLInputElement).value)).toEqual(["Walking Engine", "Main Tank"]);
    expect(screen.getAllByLabelText("Delivered gallons").map((input) => (input as HTMLInputElement).value)).toEqual(["79", "390"]);
  });

  it("clears machine-specific fills when Equipment identity changes but preserves Notes", () => {
    render(<EquipmentFuelEventForm {...baseProps} initialValues={initialValues} />);
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-2" } });
    expect(screen.getAllByRole("group", { name: /Tank Fill/ })).toHaveLength(1);
    expect(screen.getByLabelText("Tank label")).toHaveValue("");
    expect(screen.getByLabelText("Delivered gallons")).toHaveValue(null);
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Preserved event note");
  });

  it("loads only tank-label suggestions for selected Equipment", async () => {
    mocks.loadSuggestions.mockResolvedValue(["Auxiliary Tank"]);
    const { container } = render(<EquipmentFuelEventForm {...baseProps} initialTankLabelSuggestions={[]} />);
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-1" } });
    await waitFor(() => expect(mocks.loadSuggestions).toHaveBeenCalledWith("diesel-1"));
    expect(container.querySelector('datalist option[value="Auxiliary Tank"]')).toBeInTheDocument();
  });

  it("omits legacy workflow controls and presents Notes independently", () => {
    render(<EquipmentFuelEventForm {...baseProps} initialValues={initialValues} />);
    expect(screen.queryByLabelText(/Fuel Service Person/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Daily Work Log Fueling activity/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Service and timeline context" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
  });
});
