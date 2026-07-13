import { prisma } from "@/lib/prisma";

import {
  buildWorkAuthorizationWhere,
  type WorkAuthorizationFilters,
} from "./filters";

export async function getWorkAuthorizations(
  filters: WorkAuthorizationFilters = {},
) {
  return prisma.workAuthorization.findMany({
    where: buildWorkAuthorizationWhere(filters),
    include: {
      shiftReport: true,
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ shiftReport: { reportDate: "desc" } }, { createdAt: "desc" }],
  });
}

export async function getWorkAuthorizationsForDate(date: string) {
  return prisma.workAuthorization.findMany({
    where: {
      shiftReport: {
        reportDate: new Date(`${date}T00:00:00.000Z`),
      },
    },
    include: {
      shiftReport: true,
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getWorkAuthorizationFilterOptions() {
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

export async function getWorkAuthorizationFormOptions() {
  const [shiftReports, mines, equipment] = await Promise.all([
    prisma.shiftReport.findMany({
      orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
    }),
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
    shiftReportOptions: shiftReports.map((report) => ({
      id: report.id,
      label: `${displayDateOnly(report.reportDate)} - ${report.shift}`,
    })),
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

export function displayDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}
