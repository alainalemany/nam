import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stateFindMany: vi.fn(),
  cityFindMany: vi.fn(),
  cityCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    state: { findMany: mocks.stateFindMany },
    city: { findMany: mocks.cityFindMany, count: mocks.cityCount },
  },
}));

import {
  getCityManagementList,
  getCitySelectorOptions,
  getStateManagementList,
  parseCityFilters,
} from "@/features/geography/data";
import { getGasStationCityOptions } from "@/features/equipment-fuel-events/gas-station-data";

const florida = { id: "fl", name: "Florida", abbreviation: "FL", status: "ACTIVE" };
const medley = {
  id: "medley",
  name: "Medley",
  state: "FL",
  stateId: "fl",
  normalizedKey: "medley",
  status: "ACTIVE",
  stateReference: florida,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stateFindMany.mockResolvedValue([florida]);
  mocks.cityFindMany.mockResolvedValue([medley]);
  mocks.cityCount.mockResolvedValue(1);
});

describe("geography search and selection", () => {
  it("applies State search and status filters", async () => {
    await getStateManagementList({ q: "fl", status: "ACTIVE" });
    expect(mocks.stateFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "ACTIVE", OR: expect.any(Array) },
    }));
  });

  it("filters Cities by State, query, and status", async () => {
    const filters = parseCityFilters({ q: "Medley", stateId: "fl", status: "ACTIVE" });
    await getCityManagementList(filters);
    expect(mocks.cityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stateId: "fl", status: "ACTIVE", OR: expect.any(Array) }),
      take: 250,
    }));
    expect(mocks.cityCount).toHaveBeenCalledWith({ where: expect.objectContaining({ stateId: "fl" }) });
  });

  it("searches only active Cities in active States and formats State context", async () => {
    const options = await getCitySelectorOptions({ query: "Medley", stateId: "fl" });
    expect(mocks.cityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "ACTIVE",
        stateId: "fl",
        stateReference: { status: "ACTIVE" },
        OR: expect.any(Array),
      }),
      take: 50,
    }));
    expect(options).toEqual([{ id: "medley", label: "Medley, FL", status: "ACTIVE" }]);
  });

  it("retains an explicitly selected inactive City for historical editing", async () => {
    mocks.cityFindMany.mockResolvedValue([{ ...medley, status: "INACTIVE" }]);
    await getCitySelectorOptions({ query: "Medley", selectedCityId: "medley" });
    expect(mocks.cityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ id: "medley" }, expect.objectContaining({ status: "ACTIVE" })] },
    }));
  });

  it("lets Gas Stations consume the canonical searchable selector", async () => {
    const options = await getGasStationCityOptions(null, "Medley");
    expect(options[0].label).toBe("Medley, FL");
    expect(mocks.cityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ACTIVE" }),
    }));
  });
});
