import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadContext: vi.fn() }));
vi.mock("@/features/equipment-fuel-events/actions", () => ({
  getEquipmentFuelFormContextAction: mocks.loadContext,
}));

import { EquipmentFuelEventForm } from "@/features/equipment-fuel-events/EquipmentFuelEventForm";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadContext.mockResolvedValue({ dailyLogActivities: [], tankLabelSuggestions: [] });
});
const action = vi.fn(async () => ({ status: "idle" as const, message: "", fieldErrors: {} }));
const equipmentOptions = [
  { id: "diesel-1", label: "Dragline 1 #DL-1 · Mine A", displayName: "Dragline 1", equipmentNumber: "DL-1", category: "DRAGLINE" as const, powerType: "DIESEL" as const, status: "ACTIVE" as const, mineName: "Mine A", cityName: "City A", cityState: "FL" },
  { id: "diesel-2", label: "Tractor 2 #TR-2 · Mine B", displayName: "Tractor 2", equipmentNumber: "TR-2", category: "TRACTOR" as const, powerType: "DIESEL" as const, status: "ACTIVE" as const, mineName: "Mine B", cityName: "City B", cityState: "WY" },
  { id: "gas-1", label: "Truck 1 #WT-1 · Mine A", displayName: "Truck 1", equipmentNumber: "WT-1", category: "WORK_TRUCK" as const, powerType: "GASOLINE" as const, status: "ACTIVE" as const, mineName: "Mine A", cityName: "City A", cityState: "FL" },
];
const baseProps = { action, cancelHref: "/", equipmentOptions, servicePeople: [{ id: "person-1", displayName: "Pat Smith", active: true }], initialDailyLogActivities: [{ id: "activity-1", label: "2026-07-15 · 08:00 · Fueling", activityDate: "2026-07-15", equipmentId: "diesel-1" }], initialTankLabelSuggestions: ["Main Tank", "Walking Engine"], submitLabel: "Save Fuel Event" };

describe("EquipmentFuelEventForm", () => {
  it("filters Equipment and fuel choices while deriving location", () => {
    render(<EquipmentFuelEventForm {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Find Equipment"), { target: { value: "DL-1" } });
    expect(screen.getByRole("option", { name: "Dragline 1 #DL-1 · Mine A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Truck 1 #WT-1 · Mine A" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-1" } });
    expect(screen.getByText("Mine A")).toBeInTheDocument();
    expect(screen.getByText("City A, FL")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gasoline" })).toBeDisabled();
  });

  it("adds, orders, removes fills and previews the server-derived total", () => {
    render(<EquipmentFuelEventForm {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Tank label"), { target: { value: "Main Tank" } });
    fireEvent.change(screen.getByLabelText("Delivered gallons"), { target: { value: "390" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Tank Fill" }));
    const rows = screen.getAllByRole("group", { name: /Tank Fill/ });
    fireEvent.change(within(rows[1]).getByLabelText("Tank label"), { target: { value: "Walking Engine" } });
    fireEvent.change(within(rows[1]).getByLabelText("Delivered gallons"), { target: { value: "79" } });
    expect(screen.getByText("469 gal")).toBeInTheDocument();
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Move up" }));
    expect(screen.getAllByLabelText("Tank label")[0]).toHaveValue("Walking Engine");
    fireEvent.click(within(screen.getAllByRole("group", { name: /Tank Fill/ })[1]).getByRole("button", { name: "Remove" }));
    expect(screen.getAllByRole("group", { name: /Tank Fill/ })).toHaveLength(1);
  });

  it("clears machine-specific fills and Daily Log context whenever Equipment identity changes", () => {
    render(<EquipmentFuelEventForm {...baseProps} initialValues={{ operationalWorkDate: "2026-07-15", eventTime: "08:15", equipmentId: "diesel-1", fuelType: "DIESEL", fuelServicePersonId: "person-1", dailyLogActivityId: "activity-1", notes: "Preserved event note", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }, { sequence: 2, tankLabel: "Walking Engine", gallons: "79" }] }} />);
    expect(screen.getAllByRole("group", { name: /Tank Fill/ })).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-2" } });
    expect(screen.getAllByRole("group", { name: /Tank Fill/ })).toHaveLength(1);
    expect(screen.getByLabelText("Tank label")).toHaveValue("");
    expect(screen.getByLabelText("Delivered gallons")).toHaveValue(null);
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toHaveValue("");
    expect(screen.getByLabelText("Notes (optional)")).toHaveValue("Preserved event note");
  });

  it("preserves fills when correction Equipment is unchanged", () => {
    render(<EquipmentFuelEventForm {...baseProps} initialValues={{ operationalWorkDate: "2026-07-15", eventTime: "08:15", equipmentId: "diesel-1", fuelType: "DIESEL", fuelServicePersonId: "", dailyLogActivityId: "", notes: "", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }] }} />);
    fireEvent.change(screen.getByLabelText("Local event time"), { target: { value: "08:30" } });
    expect(screen.getByLabelText("Tank label")).toHaveValue("Main Tank");
    expect(screen.getByLabelText("Delivered gallons")).toHaveValue(390);
  });

  it("shows historical unavailable Equipment and requires intentional replacement", () => {
    render(<EquipmentFuelEventForm {...baseProps} unavailableEquipmentLabel="Deleted Dragline #OLD-1" initialValues={{ operationalWorkDate: "2026-07-15", eventTime: "08:15", equipmentId: "", fuelType: "DIESEL", fuelServicePersonId: "", dailyLogActivityId: "", notes: "", tankFills: [{ sequence: 1, tankLabel: "Historic Tank", gallons: "100" }] }} />);
    expect(screen.getByText(/Original Equipment unavailable/)).toHaveTextContent("Deleted Dragline #OLD-1");
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-2" } });
    expect(screen.getByLabelText("Tank label")).toHaveValue("");
  });

  it("loads Daily Log activities and tank suggestions for the selected date and Equipment", async () => {
    mocks.loadContext.mockResolvedValue({
      dailyLogActivities: [{ id: "activity-2", label: "2026-07-15 · 09:00 · Fueling", activityDate: "2026-07-15", equipmentId: null }],
      tankLabelSuggestions: ["Auxiliary Tank"],
    });
    const { container } = render(<EquipmentFuelEventForm {...baseProps} initialDailyLogActivities={[]} initialTankLabelSuggestions={[]} />);
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-1" } });
    await waitFor(() => expect(mocks.loadContext).toHaveBeenCalledWith(expect.any(String), "diesel-1", undefined));
    expect(await screen.findByRole("option", { name: "2026-07-15 · 09:00 · Fueling" })).toBeInTheDocument();
    expect(container.querySelector('datalist option[value="Auxiliary Tank"]')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tank label"), { target: { value: "Operator Custom Tank" } });
    expect(screen.getByLabelText("Tank label")).toHaveValue("Operator Custom Tank");
  });

  it("clears an incompatible Daily Log selection when date or Equipment changes", async () => {
    render(<EquipmentFuelEventForm {...baseProps} initialValues={{ operationalWorkDate: "2026-07-15", eventTime: "08:15", equipmentId: "diesel-1", fuelType: "DIESEL", fuelServicePersonId: "", dailyLogActivityId: "activity-1", notes: "", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }] }} />);
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toHaveValue("activity-1");
    fireEvent.change(screen.getByLabelText("Operational work date"), { target: { value: "2026-07-16" } });
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toHaveValue("");
    await waitFor(() => expect(mocks.loadContext).toHaveBeenCalledWith("2026-07-16", "diesel-1", undefined));

    fireEvent.change(screen.getByLabelText("Equipment"), { target: { value: "diesel-2" } });
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toHaveValue("");
    await waitFor(() => expect(mocks.loadContext).toHaveBeenCalledWith("2026-07-16", "diesel-2", undefined));
  });

  it("renders server-owned Daily Log link errors at the selector", async () => {
    const invalidLinkAction = vi.fn(async () => ({
      status: "error" as const,
      message: "Check the Daily Work Log link.",
      fieldErrors: { dailyLogActivityId: ["Only a matching Fueling activity may be linked."] },
    }));
    render(<EquipmentFuelEventForm {...baseProps} action={invalidLinkAction} initialValues={{ operationalWorkDate: "2026-07-15", eventTime: "08:15", equipmentId: "diesel-1", fuelType: "DIESEL", fuelServicePersonId: "", dailyLogActivityId: "activity-1", notes: "", tankFills: [{ sequence: 1, tankLabel: "Main Tank", gallons: "390" }] }} />);
    fireEvent.submit(screen.getByRole("button", { name: "Save Fuel Event" }).closest("form")!);
    expect(await screen.findByText("Only a matching Fueling activity may be linked.")).toBeInTheDocument();
  });
});
