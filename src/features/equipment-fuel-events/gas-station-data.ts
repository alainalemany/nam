import type { Prisma } from "@prisma/client";

import { getCitySelectorOptions } from "@/features/geography/data";
import { prisma } from "@/lib/prisma";

export type GasStationManagementFilters = {
  q?: string;
  status: "all" | "active" | "inactive";
};

export function parseGasStationFilters(input: Record<string, string | string[] | undefined>) {
  const rawQuery = typeof input.q === "string" ? input.q.trim().slice(0, 200) : "";
  const rawStatus = typeof input.status === "string" ? input.status : "all";
  return {
    q: rawQuery || undefined,
    status: rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all",
  } satisfies GasStationManagementFilters;
}

export async function getGasStationManagementList(filters: GasStationManagementFilters) {
  const where: Prisma.GasStationWhereInput = {};
  if (filters.status !== "all") where.isActive = filters.status === "active";
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { address: { contains: filters.q, mode: "insensitive" } },
      { postalCode: { contains: filters.q, mode: "insensitive" } },
      { city: { name: { contains: filters.q, mode: "insensitive" } } },
      { city: { state: { contains: filters.q, mode: "insensitive" } } },
      { city: { stateReference: { name: { contains: filters.q, mode: "insensitive" } } } },
      { city: { stateReference: { abbreviation: { contains: filters.q, mode: "insensitive" } } } },
    ];
  }
  return prisma.gasStation.findMany({
    where,
    include: {
      city: { include: { stateReference: true } },
      _count: { select: { fuelEvents: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { id: "asc" }],
    take: 250,
  });
}

export async function getGasStationForEdit(id: string) {
  return prisma.gasStation.findUnique({
    where: { id },
    include: { city: { include: { stateReference: true } } },
  });
}

export async function getGasStationCityOptions(selectedCityId?: string | null, query?: string) {
  return getCitySelectorOptions({ selectedCityId, query, limit: 50 });
}
