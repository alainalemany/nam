import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { cityDisplayLabel } from "./normalization";

export type GeographyFilters = {
  q?: string;
  status: "all" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

export type CityFilters = GeographyFilters & { stateId?: string };

export function parseGeographyFilters(input: Record<string, string | string[] | undefined>) {
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 200) : "";
  const rawStatus = typeof input.status === "string" ? input.status : "all";
  return {
    q: q || undefined,
    status: rawStatus === "ACTIVE" || rawStatus === "INACTIVE" || rawStatus === "ARCHIVED"
      ? rawStatus
      : "all",
  } satisfies GeographyFilters;
}

export function parseCityFilters(input: Record<string, string | string[] | undefined>) {
  const base = parseGeographyFilters(input);
  const stateId = typeof input.stateId === "string" ? input.stateId.trim().slice(0, 200) : "";
  return { ...base, stateId: stateId || undefined } satisfies CityFilters;
}

export async function getStateManagementList(filters: GeographyFilters) {
  const where: Prisma.StateWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { abbreviation: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return prisma.state.findMany({
    where,
    include: { _count: { select: { cities: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function getStateForEdit(id: string) {
  return prisma.state.findUnique({ where: { id } });
}

export async function getStateOptions(selectedStateId?: string | null, includeInactive = false) {
  return prisma.state.findMany({
    where: includeInactive
      ? undefined
      : { OR: [{ status: "ACTIVE" }, ...(selectedStateId ? [{ id: selectedStateId }] : [])] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function getCityManagementList(filters: CityFilters) {
  const where: Prisma.CityWhereInput = {};
  if (filters.status !== "all") where.status = filters.status;
  if (filters.stateId) where.stateId = filters.stateId;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { state: { contains: filters.q, mode: "insensitive" } },
      { stateReference: { name: { contains: filters.q, mode: "insensitive" } } },
      { stateReference: { abbreviation: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const [cities, total] = await Promise.all([
    prisma.city.findMany({
      where,
      include: {
        stateReference: true,
        _count: { select: { mines: true, gasStations: true } },
      },
      orderBy: [{ stateReference: { abbreviation: "asc" } }, { name: "asc" }, { id: "asc" }],
      take: 250,
    }),
    prisma.city.count({ where }),
  ]);
  return { cities, total };
}

export async function getCityForEdit(id: string) {
  return prisma.city.findUnique({ where: { id }, include: { stateReference: true } });
}

export async function getCitySelectorOptions(input: {
  query?: string;
  selectedCityId?: string | null;
  stateId?: string | null;
  limit?: number;
}) {
  const query = input.query?.trim().slice(0, 200);
  const activeSearch: Prisma.CityWhereInput = {
    status: "ACTIVE",
    stateReference: { status: "ACTIVE" },
    ...(input.stateId ? { stateId: input.stateId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { stateReference: { name: { contains: query, mode: "insensitive" } } },
            { stateReference: { abbreviation: { contains: query, mode: "insensitive" } } },
          ],
        }
      : { id: "__no_unselected_city__" }),
  };
  const cities = await prisma.city.findMany({
    where: input.selectedCityId
      ? { OR: [{ id: input.selectedCityId }, activeSearch] }
      : activeSearch,
    include: { stateReference: true },
    orderBy: [{ name: "asc" }, { stateReference: { abbreviation: "asc" } }, { id: "asc" }],
    take: Math.min(input.limit ?? 50, 100),
  });
  return cities.map((city) => ({ id: city.id, label: cityDisplayLabel(city), status: city.status }));
}
