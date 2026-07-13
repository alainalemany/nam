import { prisma } from "@/lib/prisma";

import {
  buildDailyInspectionWhere,
  type DailyInspectionFilters,
} from "./filters";

export async function getDailyInspections(filters: DailyInspectionFilters = {}) {
  return prisma.dailyInspection.findMany({
    where: buildDailyInspectionWhere(filters),
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDailyInspectionsForDate(date: string) {
  return prisma.dailyInspection.findMany({
    where: {
      inspectionDate: new Date(`${date}T00:00:00.000Z`),
    },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getDailyInspectionFilterOptions() {
  const equipment = await prisma.equipment.findMany({
    include: {
      mine: true,
    },
    orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
  });

  return {
    equipmentOptions: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
    })),
  };
}

export async function getDailyInspectionFormOptions() {
  const [mines, equipment] = await Promise.all([
    prisma.mine.findMany({
      include: {
        city: true,
      },
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.equipment.findMany({
      include: {
        mine: true,
      },
      orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
    }),
  ]);

  return {
    mineOptions: mines.map((mine) => ({
      id: mine.id,
      label: `${mine.name} (${mine.city.name}${mine.city.state ? `, ${mine.city.state}` : ""})`,
    })),
    equipmentOptions: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
    })),
  };
}

export function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function displayDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}
