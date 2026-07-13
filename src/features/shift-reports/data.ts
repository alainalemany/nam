import { prisma } from "@/lib/prisma";

import { buildShiftReportWhere, type ShiftReportFilters } from "./filters";

export async function getShiftReports(filters: ShiftReportFilters = {}) {
  return prisma.shiftReport.findMany({
    where: buildShiftReportWhere(filters),
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getShiftReportsForDate(date: string) {
  return prisma.shiftReport.findMany({
    where: {
      reportDate: new Date(`${date}T00:00:00.000Z`),
    },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ shift: "asc" }, { createdAt: "desc" }],
  });
}

export async function getShiftReportFilterOptions() {
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

export async function getShiftReportFormOptions() {
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
