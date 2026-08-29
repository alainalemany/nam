import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getList: vi.fn(), getCities: vi.fn(), getStation: vi.fn(),
  create: vi.fn(), update: vi.fn(), status: vi.fn(),
}));

vi.mock("@/features/equipment-fuel-events/gas-station-data", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/gas-station-data")>("@/features/equipment-fuel-events/gas-station-data");
  return { ...actual, getGasStationManagementList: mocks.getList, getGasStationCityOptions: mocks.getCities, getGasStationForEdit: mocks.getStation };
});
vi.mock("@/features/equipment-fuel-events/gas-station-actions", () => ({
  createGasStationAction: mocks.create,
  updateGasStationAction: mocks.update,
  changeGasStationStatusAction: mocks.status,
}));

import EditGasStationPage from "@/app/equipment-fuel-events/gas-stations/[id]/edit/page";
import NewGasStationPage from "@/app/equipment-fuel-events/gas-stations/new/page";
import GasStationsPage from "@/app/equipment-fuel-events/gas-stations/page";

const station = {
  id: "station-1", name: "Wawa", normalizedKey: "wawa|123 main st|city-1|33010", address: "123 Main St",
  cityId: "city-1", postalCode: "33010", isActive: true, city: { id: "city-1", name: "Hialeah", state: "FL", status: "ACTIVE" },
  _count: { fuelEvents: 4 }, createdAt: new Date(), updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getList.mockResolvedValue([station]);
  mocks.getCities.mockResolvedValue([{ id: "city-1", label: "Hialeah, FL", status: "ACTIVE" }]);
  mocks.getStation.mockResolvedValue(station);
});
afterEach(cleanup);

describe("Gas Station management routes", () => {
  it("lists searchable stations with history and non-destructive status control", async () => {
    render(await GasStationsPage({ searchParams: Promise.resolve({ q: "Wawa", status: "active" }) }));
    expect(screen.getByRole("heading", { name: "Gas Stations", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Wawa")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Inactive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(mocks.getList).toHaveBeenCalledWith({ q: "Wawa", status: "active" });
  });

  it("renders the create form with only the approved lightweight fields", async () => {
    render(await NewGasStationPage());
    expect(screen.getByLabelText("Station name")).toBeInTheDocument();
    expect(screen.getByLabelText("Address/location (optional)")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /Find City/ })).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByLabelText("ZIP/postal code (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText(/price/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/payment|loyalty|contact/i)).not.toBeInTheDocument();
  });

  it("loads an existing station for edit", async () => {
    render(await EditGasStationPage({ params: Promise.resolve({ id: "station-1" }) }));
    expect(screen.getByLabelText("Station name")).toHaveValue("Wawa");
    expect(screen.getByLabelText("Address/location (optional)")).toHaveValue("123 Main St");
    expect(screen.getByLabelText("City")).toHaveValue("city-1");
    expect(screen.getByLabelText("ZIP/postal code (optional)")).toHaveValue("33010");
  });
});
