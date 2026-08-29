import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getFilterOptions: vi.fn(),
  getEquipmentOptions: vi.fn(),
  getGasStationOptions: vi.fn(),
  getPeople: vi.fn(),
  getEvent: vi.fn(),
  getTankSuggestions: vi.fn(),
  loadTankSuggestions: vi.fn(),
}));

vi.mock("@/features/equipment-fuel-events/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/data")>("@/features/equipment-fuel-events/data");
  return {
    ...actual,
    getEquipmentFuelEvents: mocks.getEvents,
    getEquipmentFuelFilterOptions: mocks.getFilterOptions,
    getEquipmentFuelEquipmentOptions: mocks.getEquipmentOptions,
    getEquipmentFuelGasStationOptions: mocks.getGasStationOptions,
    getFuelServicePeople: mocks.getPeople,
    getEquipmentFuelEventById: mocks.getEvent,
    getTankLabelSuggestionsForEquipment: mocks.getTankSuggestions,
  };
});

vi.mock("@/features/equipment-fuel-events/actions", () => ({
  createEquipmentFuelEventAction: vi.fn(),
  correctEquipmentFuelEventAction: vi.fn(),
  saveFuelServicePersonAction: vi.fn(),
  getEquipmentFuelTankLabelSuggestionsAction: mocks.loadTankSuggestions,
}));

import CorrectEquipmentFuelEventPage from "@/app/equipment-fuel-events/[id]/edit/page";
import NewEquipmentFuelEventPage from "@/app/equipment-fuel-events/new/page";
import EquipmentFuelEventsPage from "@/app/equipment-fuel-events/page";
import FuelServicePersonnelPage from "@/app/equipment-fuel-events/service-personnel/page";

const equipment = {
  id: "equipment-1", label: "Dragline 1 #DL-1 · Mine A", displayName: "Dragline 1", equipmentNumber: "DL-1",
  category: "DRAGLINE", powerType: "DIESEL", status: "ACTIVE", mineName: "Mine A", cityName: "City A", cityState: "FL",
};
const gasStation = { id: "station-1", label: "Wawa · 123 Main St · Hialeah, FL", name: "Wawa", address: "123 Main St", cityName: "Hialeah", cityState: "FL", postalCode: null, isActive: true };

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "08:15", equipmentId: "equipment-1",
    equipmentDisplayName: "Historic Dragline", equipmentNumber: "DL-1", equipmentCategory: "DRAGLINE", mineName: "Historic Mine", cityName: "Historic City", cityState: "FL",
    fuelType: "DIESEL", totalGallons: 100, gasStationId: "station-1", gasStationNameSnapshot: "Wawa", gasStationAddressSnapshot: "123 Main St", gasStationCitySnapshot: "Hialeah", gasStationStateSnapshot: "FL", gasStationPostalCodeSnapshot: null, pricePerGallon: 3.5, totalCost: 350, meterType: "NOT_APPLICABLE", meterReading: null, receiptReference: null, fuelServicePersonId: null, fuelServicePerson: null, fuelServicePersonDisplayNameSnapshot: null,
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
  mocks.getGasStationOptions.mockResolvedValue([gasStation]);
  mocks.getPeople.mockResolvedValue([{ id: "person-1", displayName: "Pat Smith", normalizedKey: "pat smith", active: true, createdAt: new Date(), updatedAt: new Date(), _count: { fuelEvents: 1 } }]);
  mocks.getEvent.mockResolvedValue(event());
  mocks.getTankSuggestions.mockResolvedValue(["Main Tank"]);
  mocks.loadTankSuggestions.mockResolvedValue([]);
});

afterEach(cleanup);

describe("Equipment Fuel Event routes", () => {
  it("renders the URL-filtered history route", async () => {
    render(await EquipmentFuelEventsPage({ searchParams: Promise.resolve({ fuelType: "DIESEL" }) }));
    expect(screen.getByRole("heading", { name: "Equipment Fuel Events" })).toBeInTheDocument();
    expect(screen.getByText("Historic Dragline")).toBeInTheDocument();
    expect(mocks.getEvents).toHaveBeenCalledWith(expect.objectContaining({ fuelType: "DIESEL" }));
  });

  it("renders the create route without legacy person or Daily Log controls", async () => {
    render(await NewEquipmentFuelEventPage());
    expect(screen.getByRole("heading", { name: "Record Equipment Fueling" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Fuel Service Person/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Daily Work Log Fueling activity/)).not.toBeInTheDocument();
    expect(mocks.getTankSuggestions).not.toHaveBeenCalled();
  });

  it("renders correction without exposing hidden historical legacy relationships", async () => {
    mocks.getEvent.mockResolvedValue(event({
      fuelServicePersonId: "person-1",
      fuelServicePerson: { id: "person-1", displayName: "Pat Smith" },
      fuelServicePersonDisplayNameSnapshot: "Historic Pat",
      dailyLogActivityId: "activity-1",
      dailyLogActivity: { id: "activity-1", title: "Fueling", activityDate: new Date("2026-07-15T00:00:00Z") },
    }));
    render(await CorrectEquipmentFuelEventPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByRole("heading", { name: "Correct Equipment Fueling" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tank label")).toHaveValue("Main Tank");
    expect(screen.queryByLabelText(/Fuel Service Person/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Daily Work Log Fueling activity/)).not.toBeInTheDocument();
    expect(mocks.getTankSuggestions).toHaveBeenCalledWith("equipment-1");
  });

  it("renders deleted-Equipment correction without reconstructing a live relation", async () => {
    mocks.getEvent.mockResolvedValue(event({ equipmentId: null, equipmentDisplayName: "Deleted Dragline", equipmentNumber: "OLD-1" }));
    render(await CorrectEquipmentFuelEventPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByText(/Original Equipment unavailable/)).toHaveTextContent("Deleted Dragline #OLD-1");
    expect(screen.getByLabelText("Equipment")).toHaveValue("");
    expect(mocks.getTankSuggestions).not.toHaveBeenCalled();
  });

  it("renders Fuel Service Person management with historical usage", async () => {
    render(await FuelServicePersonnelPage());
    expect(screen.getByRole("heading", { name: "Fuel Service Personnel" })).toBeInTheDocument();
    expect(screen.getByText("Pat Smith")).toBeInTheDocument();
    expect(screen.getByText(/1 historical Fuel Events/)).toBeInTheDocument();
  });
});
