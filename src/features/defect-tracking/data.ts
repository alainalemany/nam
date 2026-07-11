import { prisma } from "@/lib/prisma";

export async function getDefects() {
  return prisma.defect.findMany({
    include: {
      equipment: { include: { mine: true } },
      sourceDailyInspection: true,
    },
    orderBy: [{ reportedDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDefect(id: string) {
  return prisma.defect.findUnique({
    where: { id },
    include: {
      equipment: { include: { mine: { include: { city: true } } } },
      sourceDailyInspection: true,
    },
  });
}

export async function getDefectsForDate(date: string) {
  return prisma.defect.findMany({
    where: { reportedDate: new Date(`${date}T00:00:00.000Z`) },
    include: { equipment: { include: { mine: true } } },
    orderBy: [{ priority: "desc" }, { severity: "desc" }, { createdAt: "desc" }],
  });
}

export async function getDefectFormOptions() {
  const [equipment, inspections] = await Promise.all([
    prisma.equipment.findMany({
      include: { mine: true },
      orderBy: [{ mine: { name: "asc" } }, { displayName: "asc" }],
    }),
    prisma.dailyInspection.findMany({
      include: { equipment: true },
      orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    equipmentOptions: equipment.map((item) => ({
      id: item.id,
      label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} (${item.mine.name})`,
    })),
    inspectionOptions: inspections.map((inspection) => ({
      id: inspection.id,
      label: `${displayDateOnly(inspection.inspectionDate)} - ${inspection.equipment?.displayName ?? "Equipment not set"}`,
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

export function displayDateTime(value: Date | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
