import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  geographySeedFingerprint,
  importUsGeography,
  loadGeographySeed,
  planCityImport,
  planStateImport,
} from "@/features/geography/import";
import { normalizeGeographyKey } from "@/features/geography/normalization";

const expectedAbbreviations = (
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
).split(" ");

describe("canonical U.S. geography seed", () => {
  const seed = loadGeographySeed();

  it("contains every State and District of Columbia exactly once, without territories", () => {
    expect(seed.states.map((state) => state.abbreviation).sort()).toEqual(expectedAbbreviations.sort());
    expect(new Set(seed.states.map((state) => state.abbreviation)).size).toBe(51);
    expect(seed.states.some((state) => state.abbreviation === "PR")).toBe(false);
  });

  it("contains broad, State-qualified place data including Medley", () => {
    expect(seed.cities.length).toBe(31_847);
    expect(seed.cities).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Florida City", stateAbbreviation: "FL" }),
      expect.objectContaining({ name: "Hialeah", stateAbbreviation: "FL" }),
      expect.objectContaining({ name: "Medley", stateAbbreviation: "FL" }),
      expect.objectContaining({ name: "Portland", stateAbbreviation: "ME" }),
      expect.objectContaining({ name: "Portland", stateAbbreviation: "OR" }),
    ]));
    const keys = seed.cities.map((city) => `${city.stateAbbreviation}|${normalizeGeographyKey(city.name)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches the committed manifest and deterministic compressed artifact", () => {
    const manifest = JSON.parse(readFileSync(
      resolve(process.cwd(), "data/geography/us-census-gazetteer-2025.manifest.json"),
      "utf8",
    ));
    expect(manifest).toMatchObject({ stateCount: 51, cityCount: 31_847, excludedTerritories: ["PR"] });
    expect(geographySeedFingerprint(seed)).toMatch(/^[a-f0-9]{64}$/);
    expect(gunzipSync(readFileSync(resolve(process.cwd(), "data/geography/us-cities-2025.tsv.gz"))).length)
      .toBeGreaterThan(500_000);
  });

  it("reuses legacy Cities, including user-created places absent from Census, without changing status", () => {
    const statePlan = planStateImport([], seed.states);
    const states = statePlan.creates.map((state, index) => ({
      id: `state-${index}`,
      ...state,
      status: "ACTIVE",
    }));
    const florida = states.find((state) => state.abbreviation === "FL")!;
    const existing = [
      { id: "hialeah-existing", name: "Hialeah", state: "FL", stateId: null, normalizedKey: null, status: "INACTIVE" },
      { id: "florida-city-existing", name: "Florida City", state: "FL", stateId: null, normalizedKey: null, status: "ACTIVE" },
      { id: "west-kendall-existing", name: "West Kendall", state: "FL", stateId: null, normalizedKey: null, status: "ACTIVE" },
    ];
    const plan = planCityImport(existing, states, seed.cities);
    expect(plan.updates).toEqual(expect.arrayContaining([
      { id: "hialeah-existing", data: { normalizedKey: "hialeah", state: "FL", stateId: florida.id } },
      { id: "florida-city-existing", data: { normalizedKey: "florida city", state: "FL", stateId: florida.id } },
      { id: "west-kendall-existing", data: { normalizedKey: "west kendall", state: "FL", stateId: florida.id } },
    ]));
    expect(plan.creates.some((city) => city.name === "Hialeah" && city.state === "FL")).toBe(false);
    expect(existing[0].status).toBe("INACTIVE");
  });

  it("is idempotent after applying the first import plan", () => {
    const firstStatePlan = planStateImport([], seed.states);
    const states = firstStatePlan.creates.map((state, index) => ({ id: `state-${index}`, ...state, status: "ACTIVE" }));
    const firstCityPlan = planCityImport([], states, seed.cities);
    const cities = firstCityPlan.creates.map((city, index) => ({ id: `city-${index}`, ...city, status: "ACTIVE" }));

    const secondStatePlan = planStateImport(states, seed.states);
    const secondCityPlan = planCityImport(cities, states, seed.cities);
    expect(secondStatePlan.creates).toHaveLength(0);
    expect(secondStatePlan.updates).toHaveLength(0);
    expect(secondCityPlan.creates).toHaveLength(0);
    expect(secondCityPlan.updates).toHaveLength(0);
    expect(cities.map((city) => city.id)).toEqual(firstCityPlan.creates.map((_, index) => `city-${index}`));
  });

  it("executes an idempotent first and second import without reactivating existing rows", async () => {
    const states: Array<Record<string, unknown>> = [];
    const cities: Array<Record<string, unknown>> = [
      { id: "hialeah-existing", name: "Hialeah", state: "FL", stateId: null, normalizedKey: null, status: "INACTIVE" },
    ];
    const client = {
      state: {
        findMany: async () => states.map((state) => ({ ...state })),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const record = { id: `state-${states.length + 1}`, status: "ACTIVE", ...data };
          states.push(record);
          return record;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const record = states.find((state) => state.id === where.id)!;
          Object.assign(record, data);
          return record;
        },
      },
      city: {
        findMany: async () => cities.map((city) => ({ ...city })),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const record = cities.find((city) => city.id === where.id)!;
          Object.assign(record, data);
          return record;
        },
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const item of data) cities.push({ id: `city-${cities.length + 1}`, status: "ACTIVE", ...item });
          return { count: data.length };
        },
      },
    } as unknown as PrismaClient;
    const smallSeed = {
      states: [{ abbreviation: "FL", censusGeoid: "12", name: "Florida" }],
      cities: [
        { stateAbbreviation: "FL", censusGeoid: "1230000", name: "Hialeah" },
        { stateAbbreviation: "FL", censusGeoid: "1243900", name: "Medley" },
      ],
    };

    expect(await importUsGeography(client, smallSeed)).toEqual({
      statesCreated: 1,
      statesReused: 0,
      statesUpdated: 0,
      citiesCreated: 1,
      citiesReused: 1,
      citiesUpdated: 1,
    });
    expect(cities.find((city) => city.id === "hialeah-existing")).toMatchObject({
      status: "INACTIVE",
      stateId: "state-1",
      normalizedKey: "hialeah",
    });
    expect(await importUsGeography(client, smallSeed)).toEqual({
      statesCreated: 0,
      statesReused: 1,
      statesUpdated: 0,
      citiesCreated: 0,
      citiesReused: 2,
      citiesUpdated: 0,
    });
    expect(cities).toHaveLength(2);
  });
});
