import { Prisma } from "@prisma/client";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getEvent: vi.fn() }));
vi.mock("@/features/equipment-fuel-events/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/data")>("@/features/equipment-fuel-events/data");
  return { ...actual, getEquipmentFuelEventById: mocks.getEvent };
});

import EquipmentFuelEventDetailPage from "@/app/equipment-fuel-events/[id]/page";

afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "23:45", equipmentId: "equipment-1",
    equipmentDisplayName: "Tundra", equipmentNumber: "131909", equipmentCategory: "WORK_TRUCK", mineName: "White Rock", cityName: "Equipment City", cityState: "FL",
    fuelType: "GASOLINE", totalGallons: new Prisma.Decimal("12.5"),
    gasStationId: "station-1", gasStationNameSnapshot: "Wawa", gasStationAddressSnapshot: "123 Main St", gasStationCitySnapshot: "Hialeah", gasStationStateSnapshot: "FL", gasStationPostalCodeSnapshot: "33010",
    pricePerGallon: new Prisma.Decimal("3.457"), totalCost: new Prisma.Decimal("43.21"), meterType: "ODOMETER", meterReading: new Prisma.Decimal("4500.125"), receiptReference: "R-100",
    fuelServicePersonId: "person-1", fuelServicePersonDisplayNameSnapshot: "Historic Pat", dailyLogActivityId: "activity-1",
    notes: "Operational note", createdAt: new Date(), updatedAt: new Date(), gasStation: null,
    tankFills: [
      { id: "fill-1", equipmentFuelEventId: "event-1", sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: new Prisma.Decimal("12.347"), createdAt: new Date(), updatedAt: new Date() },
      { id: "fill-2", equipmentFuelEventId: "event-1", sequence: 2, tankLabel: "Auxiliary", normalizedTankLabel: "auxiliary", gallons: new Prisma.Decimal("0.153"), createdAt: new Date(), updatedAt: new Date() },
    ],
    ...overrides,
  };
}

describe("Equipment Fuel Event detail", () => {
  it("renders the approved V2 presentation without obsolete legacy context", async () => {
    mocks.getEvent.mockResolvedValue(event());
    render(await EquipmentFuelEventDetailPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByRole("heading", { name: "Tundra · 131909" })).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toHaveClass("ddr-status-badge--completed");
    expect(screen.getByText("Work Truck")).toBeInTheDocument();
    expect(screen.getByText("Wawa · 123 Main St · Hialeah, FL 33010")).toBeInTheDocument();
    expect(screen.queryByText(/White Rock/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Historic Pat/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Daily Work Log/)).not.toBeInTheDocument();
    expect(screen.getByText("12.347 gal")).toBeInTheDocument();
    expect(screen.getByText("$3.457")).toBeInTheDocument();
    expect(screen.getAllByText("$43.21").length).toBeGreaterThan(0);
    expect(screen.getByText("Odometer · 4500.125")).toBeInTheDocument();
    expect(screen.getByText("R-100")).toBeInTheDocument();
  });

  it("renders legacy rows neutrally without fabricating V2 facts", async () => {
    mocks.getEvent.mockResolvedValue(event({
      equipmentId: null, equipmentDisplayName: "Deleted Dragline", equipmentNumber: null, equipmentCategory: "DRAGLINE",
      gasStationId: null, gasStationNameSnapshot: null, gasStationAddressSnapshot: null, gasStationCitySnapshot: null,
      gasStationStateSnapshot: null, gasStationPostalCodeSnapshot: null, pricePerGallon: null, totalCost: null,
      meterType: null, meterReading: null, receiptReference: null,
    }));
    render(await EquipmentFuelEventDetailPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByRole("heading", { name: "Deleted Dragline" })).toBeInTheDocument();
    expect(screen.getAllByText("Not recorded (legacy event)").length).toBeGreaterThanOrEqual(3);
  });

  it("shows accessible create success feedback and consumes its query state", async () => {
    mocks.getEvent.mockResolvedValue(event());
    window.history.replaceState({}, "", "/equipment-fuel-events/event-1?result=created");
    render(await EquipmentFuelEventDetailPage({
      params: Promise.resolve({ id: "event-1" }),
      searchParams: Promise.resolve({ result: "created" }),
    }));
    expect(screen.getByRole("status")).toHaveTextContent("Fuel event saved successfully.");
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("shows correction-specific success feedback", async () => {
    mocks.getEvent.mockResolvedValue(event());
    window.history.replaceState({}, "", "/equipment-fuel-events/event-1?result=corrected");
    render(await EquipmentFuelEventDetailPage({
      params: Promise.resolve({ id: "event-1" }),
      searchParams: Promise.resolve({ result: "corrected" }),
    }));
    expect(screen.getByRole("status")).toHaveTextContent("Fuel event updated successfully.");
  });
});
