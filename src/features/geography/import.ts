import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import type { PrismaClient } from "@prisma/client";

import { normalizeGeographyKey, normalizeStateAbbreviation } from "./normalization.ts";

export type GeographySeedState = {
  abbreviation: string;
  censusGeoid: string;
  name: string;
};

export type GeographySeedCity = {
  stateAbbreviation: string;
  censusGeoid: string;
  name: string;
};

export type GeographySeed = {
  states: GeographySeedState[];
  cities: GeographySeedCity[];
};

type ExistingState = {
  id: string;
  name: string;
  abbreviation: string;
  normalizedKey: string;
  status: string;
};

type ExistingCity = {
  id: string;
  name: string;
  state: string | null;
  stateId: string | null;
  normalizedKey: string | null;
  status: string;
};

function parseTsv(value: string) {
  const [headerLine, ...lines] = value.trim().split(/\r?\n/);
  const header = headerLine.split("\t");
  return lines.map((line) => Object.fromEntries(line.split("\t").map((cell, index) => [header[index], cell])));
}

export function loadGeographySeed(dataDirectory = resolve(process.cwd(), "data/geography")): GeographySeed {
  const states = parseTsv(readFileSync(resolve(dataDirectory, "us-states-2025.tsv"), "utf8"))
    .map((row) => ({
      abbreviation: normalizeStateAbbreviation(row.state_abbreviation),
      censusGeoid: row.census_geoid,
      name: row.name,
    }));
  const cities = parseTsv(
    gunzipSync(readFileSync(resolve(dataDirectory, "us-cities-2025.tsv.gz"))).toString("utf8"),
  ).map((row) => ({
    stateAbbreviation: normalizeStateAbbreviation(row.state_abbreviation),
    censusGeoid: row.census_geoid,
    name: row.name,
  }));
  return { states, cities };
}

export function geographySeedFingerprint(seed: GeographySeed) {
  return createHash("sha256").update(JSON.stringify(seed)).digest("hex");
}

export function planStateImport(existing: ExistingState[], seed: GeographySeedState[]) {
  const byAbbreviation = new Map(existing.map((state) => [normalizeStateAbbreviation(state.abbreviation), state]));
  const byName = new Map(existing.map((state) => [normalizeGeographyKey(state.name), state]));
  const creates: Omit<ExistingState, "id" | "status">[] = [];
  const updates: Array<{ id: string; data: Omit<ExistingState, "id" | "status"> }> = [];

  for (const source of seed) {
    const abbreviation = normalizeStateAbbreviation(source.abbreviation);
    const normalizedKey = normalizeGeographyKey(source.name);
    const abbreviationMatch = byAbbreviation.get(abbreviation);
    const nameMatch = byName.get(normalizedKey);
    if (abbreviationMatch && nameMatch && abbreviationMatch.id !== nameMatch.id) {
      throw new Error(`State source ${source.name} conflicts with existing State records.`);
    }
    const retained = abbreviationMatch ?? nameMatch;
    const data = { name: source.name, abbreviation, normalizedKey };
    if (!retained) creates.push(data);
    else if (
      retained.name !== data.name
      || retained.abbreviation !== data.abbreviation
      || retained.normalizedKey !== data.normalizedKey
    ) updates.push({ id: retained.id, data });
  }
  return { creates, updates };
}

export function planCityImport(
  existing: ExistingCity[],
  states: ExistingState[],
  seed: GeographySeedCity[],
) {
  const stateById = new Map(states.map((state) => [state.id, state]));
  const stateByAbbreviation = new Map(states.map((state) => [normalizeStateAbbreviation(state.abbreviation), state]));
  const existingByKey = new Map<string, ExistingCity>();

  for (const city of existing) {
    const abbreviation = city.stateId
      ? stateById.get(city.stateId)?.abbreviation
      : city.state;
    if (!abbreviation) continue;
    const key = `${normalizeStateAbbreviation(abbreviation)}|${normalizeGeographyKey(city.name)}`;
    const conflict = existingByKey.get(key);
    if (conflict && conflict.id !== city.id) {
      throw new Error(`Existing Cities conflict after normalization: ${city.name}, ${abbreviation}.`);
    }
    existingByKey.set(key, city);
  }

  const creates: Array<{
    name: string;
    normalizedKey: string;
    state: string;
    stateId: string;
  }> = [];
  const updatesById = new Map<string, {
    id: string;
    data: { normalizedKey: string; state: string; stateId: string };
  }>();
  const seenSource = new Set<string>();

  for (const city of existing) {
    const abbreviation = city.stateId
      ? stateById.get(city.stateId)?.abbreviation
      : city.state;
    const state = abbreviation
      ? stateByAbbreviation.get(normalizeStateAbbreviation(abbreviation))
      : undefined;
    if (!state) continue;
    const data = {
      normalizedKey: normalizeGeographyKey(city.name),
      state: state.abbreviation,
      stateId: state.id,
    };
    if (
      city.normalizedKey !== data.normalizedKey
      || city.state !== data.state
      || city.stateId !== data.stateId
    ) updatesById.set(city.id, { id: city.id, data });
  }

  for (const source of seed) {
    const abbreviation = normalizeStateAbbreviation(source.stateAbbreviation);
    const state = stateByAbbreviation.get(abbreviation);
    if (!state) throw new Error(`City source references missing State ${abbreviation}.`);
    const normalizedKey = normalizeGeographyKey(source.name);
    const key = `${abbreviation}|${normalizedKey}`;
    if (seenSource.has(key)) continue;
    seenSource.add(key);
    const retained = existingByKey.get(key);
    const data = { normalizedKey, state: abbreviation, stateId: state.id };
    if (!retained) creates.push({ name: source.name, ...data });
    else if (
      retained.normalizedKey !== data.normalizedKey
      || retained.state !== data.state
      || retained.stateId !== data.stateId
    ) updatesById.set(retained.id, { id: retained.id, data });
  }
  return { creates, updates: [...updatesById.values()] };
}

export async function importUsGeography(client: PrismaClient, seed = loadGeographySeed()) {
  const existingStates = await client.state.findMany();
  const statePlan = planStateImport(existingStates, seed.states);
  for (const state of statePlan.creates) await client.state.create({ data: state });
  for (const state of statePlan.updates) {
    await client.state.update({ where: { id: state.id }, data: state.data });
  }

  const states = await client.state.findMany();
  const existingCities = await client.city.findMany({
    select: { id: true, name: true, state: true, stateId: true, normalizedKey: true, status: true },
  });
  const cityPlan = planCityImport(existingCities, states, seed.cities);
  for (const city of cityPlan.updates) {
    await client.city.update({ where: { id: city.id }, data: city.data });
  }
  for (let index = 0; index < cityPlan.creates.length; index += 1000) {
    await client.city.createMany({ data: cityPlan.creates.slice(index, index + 1000), skipDuplicates: true });
  }

  return {
    statesCreated: statePlan.creates.length,
    statesReused: seed.states.length - statePlan.creates.length,
    statesUpdated: statePlan.updates.length,
    citiesCreated: cityPlan.creates.length,
    citiesReused: seed.cities.length - cityPlan.creates.length,
    citiesUpdated: cityPlan.updates.length,
  };
}
