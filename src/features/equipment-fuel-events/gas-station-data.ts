import type { Prisma } from "@prisma/client";

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
    ];
  }
  return prisma.gasStation.findMany({
    where,
    include: {
      city: true,
      _count: { select: { fuelEvents: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }, { id: "asc" }],
    take: 250,
  });
}

export async function getGasStationForEdit(id: string) {
  return prisma.gasStation.findUnique({ where: { id }, include: { city: true } });
}

export async function getGasStationCityOptions(selectedCityId?: string | null) {
  const cities = await prisma.city.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        ...(selectedCityId ? [{ id: selectedCityId }] : []),
      ],
    },
    orderBy: [{ name: "asc" }, { state: "asc" }],
  });
  return cities.map((city) => ({
    id: city.id,
    label: `${city.name}${city.state ? `, ${city.state}` : ""}`,
    status: city.status,
  }));
}
