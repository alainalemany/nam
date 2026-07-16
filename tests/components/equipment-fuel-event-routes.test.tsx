import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getFilterOptions: vi.fn(),
  getEquipmentOptions: vi.fn(),
  getPersonOptions: vi.fn(),
  getPeople: vi.fn(),
  getEvent: vi.fn(),
  getFormContext: vi.fn(),
  loadFormContext: vi.fn(),
}));

vi.mock("@/features/equipment-fuel-events/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/data")>("@/features/equipment-fuel-events/data");
  return {
    ...actual,
    getEquipmentFuelEvents: mocks.getEvents,
    getEquipmentFuelFilterOptions: mocks.getFilterOptions,
    getEquipmentFuelEquipmentOptions: mocks.getEquipmentOptions,
    getFuelServicePersonOptions: mocks.getPersonOptions,
    getFuelServicePeople: mocks.getPeople,
    getEquipmentFuelEventById: mocks.getEvent,
    getEquipmentFuelFormContext: mocks.getFormContext,
  };
});

vi.mock("@/features/equipment-fuel-events/actions", () => ({
  createEquipmentFuelEventAction: vi.fn(),
  correctEquipmentFuelEventAction: vi.fn(),
  saveFuelServicePersonAction: vi.fn(),
  getEquipmentFuelFormContextAction: mocks.loadFormContext,
}));

import CorrectEquipmentFuelEventPage from "@/app/equipment-fuel-events/[id]/edit/page";
import NewEquipmentFuelEventPage from "@/app/equipment-fuel-events/new/page";
import EquipmentFuelEventsPage from "@/app/equipment-fuel-events/page";
import FuelServicePersonnelPage from "@/app/equipment-fuel-events/service-personnel/page";

const equipment = {
  id: "equipment-1", label: "Dragline 1 #DL-1 · Mine A", displayName: "Dragline 1", equipmentNumber: "DL-1",
  category: "DRAGLINE", powerType: "DIESEL", status: "ACTIVE", mineName: "Mine A", cityName: "City A", cityState: "FL",
};

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "08:15", equipmentId: "equipment-1",
    equipmentDisplayName: "Historic Dragline", equipmentNumber: "DL-1", equipmentCategory: "DRAGLINE", mineName: "Historic Mine", cityName: "Historic City", cityState: "FL",
    fuelType: "DIESEL", totalGallons: 100, fuelServicePersonId: null, fuelServicePerson: null, fuelServicePersonDisplayNameSnapshot: null,
    dailyLogActivityId: null, dailyLogActivity: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    tankFills: [{ id: "fill-1", equipmentFuelEventId: "event-1", sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: 100, createdAt: new Date(), updatedAt: new Date() }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEvents.mockResolvedValue([event()]);
  mocks.getFilterOptions.mockResolvedValue({ equipment: [{ id: "equipment-1", displayName: "Dragline 1", equipmentNumber: "DL-1" }], people: [] });
  mocks.getEquipmentOptions.mockResolvedValue([equipment]);
  mocks.getPersonOptions.mockResolvedValue([]);
  mocks.getPeople.mockResolvedValue([{ id: "person-1", displayName: "Pat Smith", normalizedKey: "pat smith", active: true, createdAt: new Date(), updatedAt: new Date(), _count: { fuelEvents: 1 } }]);
  mocks.getEvent.mockResolvedValue(event());
  mocks.getFormContext.mockResolvedValue({ dailyLogActivities: [], tankLabelSuggestions: ["Main Tank"] });
  mocks.loadFormContext.mockResolvedValue({ dailyLogActivities: [], tankLabelSuggestions: [] });
});

afterEach(cleanup);

describe("Equipment Fuel Event routes", () => {
  it("renders the URL-filtered history route", async () => {
    render(await EquipmentFuelEventsPage({ searchParams: Promise.resolve({ fuelType: "DIESEL" }) }));
    expect(screen.getByRole("heading", { name: "Equipment Fuel Events" })).toBeInTheDocument();
    expect(screen.getByText("Historic Dragline")).toBeInTheDocument();
    expect(mocks.getEvents).toHaveBeenCalledWith(expect.objectContaining({ fuelType: "DIESEL" }));
  });

  it("renders the create route without globally preloading Daily Log activities", async () => {
    render(await NewEquipmentFuelEventPage());
    expect(screen.getByRole("heading", { name: "Record Equipment Fueling" })).toBeInTheDocument();
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toBeDisabled();
    expect(mocks.getFormContext).not.toHaveBeenCalled();
  });

  it("renders correction with context scoped to the current event", async () => {
    mocks.getEvent.mockResolvedValue(event({ dailyLogActivityId: "activity-1", dailyLogActivity: { id: "activity-1", title: "Fueling", activityDate: new Date("2026-07-15T00:00:00Z") } }));
    mocks.getFormContext.mockResolvedValue({
      dailyLogActivities: [{ id: "activity-1", label: "2026-07-15 · 08:00 · Fueling", activityDate: "2026-07-15", equipmentId: "equipment-1" }],
      tankLabelSuggestions: ["Main Tank"],
    });
    render(await CorrectEquipmentFuelEventPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByRole("heading", { name: "Correct Equipment Fueling" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tank label")).toHaveValue("Main Tank");
    expect(screen.getByLabelText("Daily Work Log Fueling activity (optional)")).toHaveValue("activity-1");
    expect(mocks.getFormContext).toHaveBeenCalledWith({ operationalWorkDate: "2026-07-15", equipmentId: "equipment-1", currentEventId: "event-1" });
  });

  it("renders deleted-Equipment correction without reconstructing a live relation", async () => {
    mocks.getEvent.mockResolvedValue(event({ equipmentId: null, equipmentDisplayName: "Deleted Dragline", equipmentNumber: "OLD-1" }));
    render(await CorrectEquipmentFuelEventPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByText(/Original Equipment unavailable/)).toHaveTextContent("Deleted Dragline #OLD-1");
    expect(screen.getByLabelText("Equipment")).toHaveValue("");
    expect(mocks.getFormContext).not.toHaveBeenCalled();
  });

  it("renders Fuel Service Person management with historical usage", async () => {
    render(await FuelServicePersonnelPage());
    expect(screen.getByRole("heading", { name: "Fuel Service Personnel" })).toBeInTheDocument();
    expect(screen.getByText("Pat Smith")).toBeInTheDocument();
    expect(screen.getByText(/1 historical Fuel Events/)).toBeInTheDocument();
  });
});
