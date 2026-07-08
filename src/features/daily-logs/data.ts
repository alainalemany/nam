import { prisma } from "@/lib/prisma";

import { buildDailyLogWhere, type DailyLogFilters } from "./filters";

export async function getDailyLogs(filters: DailyLogFilters) {
  return prisma.dailyLog.findMany({
    where: buildDailyLogWhere(filters),
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      primaryEquipment: true,
      activities: {
        orderBy: {
          sequence: "asc",
        },
        take: 1,
      },
    },
    orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDailyLogsForDate(date: string) {
  return getDailyLogs({
    dateFrom: date,
    dateTo: date,
  });
}

export async function getDailyLogFormOptions() {
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
