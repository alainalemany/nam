import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getEvent: vi.fn() }));
vi.mock("@/features/equipment-fuel-events/data", async () => {
  const actual = await vi.importActual<typeof import("@/features/equipment-fuel-events/data")>("@/features/equipment-fuel-events/data");
  return { ...actual, getEquipmentFuelEventById: mocks.getEvent };
});

import EquipmentFuelEventDetailPage from "@/app/equipment-fuel-events/[id]/page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Equipment Fuel Event detail", () => {
  it("renders SetNull history, ordered fills, service-person snapshot, and no delete workflow", async () => {
    mocks.getEvent.mockResolvedValue({
      id: "event-1", operationalWorkDate: new Date("2026-07-15T00:00:00Z"), eventTime: "23:45", equipmentId: null,
      equipmentDisplayName: "Deleted Dragline", equipmentNumber: "DL-OLD", equipmentCategory: "DRAGLINE", mineName: "Historic Mine", cityName: "Historic City", cityState: "WY",
      fuelType: "OFF_ROAD_DIESEL", totalGallons: 469, fuelServicePersonId: null, fuelServicePerson: null, fuelServicePersonDisplayNameSnapshot: "Historic Pat", dailyLogActivityId: null, dailyLogActivity: null,
      notes: null, createdAt: new Date(), updatedAt: new Date(),
      tankFills: [{ id: "fill-1", equipmentFuelEventId: "event-1", sequence: 1, tankLabel: "Main Tank", normalizedTankLabel: "main tank", gallons: 390, createdAt: new Date(), updatedAt: new Date() }, { id: "fill-2", equipmentFuelEventId: "event-1", sequence: 2, tankLabel: "Walking Engine", normalizedTankLabel: "walking engine", gallons: 79, createdAt: new Date(), updatedAt: new Date() }],
    });
    render(await EquipmentFuelEventDetailPage({ params: Promise.resolve({ id: "event-1" }) }));
    expect(screen.getByRole("heading", { name: "Deleted Dragline" })).toBeInTheDocument();
    expect(screen.getByText("Historic Mine · Historic City, WY")).toBeInTheDocument();
    expect(screen.getByText("Historic Pat")).toBeInTheDocument();
    expect(screen.getByText("Walking Engine")).toBeInTheDocument();
    expect(screen.getByText("469 gal", { selector: "th" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Correct Fuel Event" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
