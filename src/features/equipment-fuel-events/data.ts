import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildEquipmentFuelWhere, type EquipmentFuelFilters } from "./filters";
import type {
  EquipmentFuelEquipmentOption,
  EquipmentFuelEventFormInitialValues,
  EquipmentFuelFormContext,
  FuelDailyLogActivityOption,
  FuelServicePersonOption,
} from "./types";
import { equipmentFuelDateToUtc, isEquipmentFuelDateOnly } from "./date";
import { deduplicateTankLabelSuggestions } from "./validation";

const eventDetailInclude = {
  tankFills: { orderBy: { sequence: "asc" as const } },
  fuelServicePerson: true,
  dailyLogActivity: true,
} satisfies Prisma.EquipmentFuelEventInclude;

export async function getEquipmentFuelEvents(filters: EquipmentFuelFilters = {}) {
  return prisma.equipmentFuelEvent.findMany({
    where: buildEquipmentFuelWhere(filters),
    include: { tankFills: { orderBy: { sequence: "asc" } } },
    orderBy: [
      { operationalWorkDate: "desc" },
      { eventTime: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: 250,
  });
}

export async function getEquipmentFuelEventById(id: string) {
  return prisma.equipmentFuelEvent.findUnique({ where: { id }, include: eventDetailInclude });
}

export async function getEquipmentFuelEquipmentOptions(selectedEquipmentId?: string | null) {
  const equipment = await prisma.equipment.findMany({
    where: {
      OR: [
        {
          status: "ACTIVE",
          OR: [
            { powerType: null },
            { powerType: { not: "ELECTRIC" } },
          ],
        },
        ...(selectedEquipmentId ? [{ id: selectedEquipmentId }] : []),
      ],
    },
    include: { mine: { include: { city: true } } },
    orderBy: [{ displayName: "asc" }, { equipmentNumber: "asc" }],
  });
  return equipment.map((item): EquipmentFuelEquipmentOption => ({
    id: item.id,
    label: `${item.displayName}${item.equipmentNumber ? ` #${item.equipmentNumber}` : ""} · ${item.mine.name}`,
    displayName: item.displayName,
    equipmentNumber: item.equipmentNumber,
    category: item.category,
    powerType: item.powerType,
    status: item.status,
    mineName: item.mine.name,
    cityName: item.mine.city.name,
    cityState: item.mine.city.state,
  }));
}

export async function getFuelServicePersonOptions(selectedPersonId?: string | null) {
  const records = await prisma.fuelServicePerson.findMany({
    where: {
      OR: [
        { active: true },
        ...(selectedPersonId ? [{ id: selectedPersonId }] : []),
      ],
    },
    orderBy: { displayName: "asc" },
  });
  return records.map((record): FuelServicePersonOption => ({
    id: record.id,
    displayName: record.displayName,
    active: record.active,
  }));
}

export async function getFuelServicePeople() {
  return prisma.fuelServicePerson.findMany({
    include: { _count: { select: { fuelEvents: true } } },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });
}

export async function getFuelDailyLogActivityOptions({
  operationalWorkDate,
  equipmentId,
  currentEventId,
}: {
  operationalWorkDate: string;
  equipmentId: string;
  currentEventId?: string | null;
}) {
  const normalizedEquipmentId = equipmentId.trim();
  if (!isEquipmentFuelDateOnly(operationalWorkDate) || !normalizedEquipmentId) return [];

  const activities = await prisma.dailyLogActivity.findMany({
    where: {
      activityType: "FUEL_SERVICE",
      activityDate: equipmentFuelDateToUtc(operationalWorkDate),
      AND: [
        { OR: [{ equipmentId: null }, { equipmentId: normalizedEquipmentId }] },
        {
          OR: [
            { equipmentFuelEvent: null },
            ...(currentEventId ? [{ equipmentFuelEvent: { id: currentEventId } }] : []),
          ],
        },
      ],
    },
    include: { equipment: true },
    orderBy: [{ startTime: "asc" }, { sequence: "asc" }, { id: "asc" }],
    take: 100,
  });
  return activities.map((activity): FuelDailyLogActivityOption => ({
    id: activity.id,
    activityDate: activity.activityDate.toISOString().slice(0, 10),
    equipmentId: activity.equipmentId,
    label: `${activity.activityDate.toISOString().slice(0, 10)} · ${activity.startTime ?? "Time not recorded"} · ${activity.title}${activity.equipment ? ` · ${activity.equipment.displayName}` : ""}`,
  }));
}

export async function getTankLabelSuggestionsForEquipment(equipmentId: string) {
  const normalizedEquipmentId = equipmentId.trim();
  if (!normalizedEquipmentId) return [];

  const fills = await prisma.equipmentFuelEventTankFill.findMany({
    where: { equipmentFuelEvent: { equipmentId: normalizedEquipmentId } },
    select: {
      tankLabel: true,
    },
    orderBy: [
      { equipmentFuelEvent: { operationalWorkDate: "desc" } },
      { equipmentFuelEvent: { createdAt: "desc" } },
      { equipmentFuelEvent: { id: "desc" } },
      { sequence: "asc" },
      { id: "asc" },
    ],
    take: 250,
  });
  return deduplicateTankLabelSuggestions(fills.map((fill) => fill.tankLabel));
}

export async function getEquipmentFuelFormContext({
  operationalWorkDate,
  equipmentId,
  currentEventId,
}: {
  operationalWorkDate: string;
  equipmentId: string;
  currentEventId?: string | null;
}): Promise<EquipmentFuelFormContext> {
  if (!equipmentId.trim()) return { dailyLogActivities: [], tankLabelSuggestions: [] };
  const [dailyLogActivities, tankLabelSuggestions] = await Promise.all([
    getFuelDailyLogActivityOptions({ operationalWorkDate, equipmentId, currentEventId }),
    getTankLabelSuggestionsForEquipment(equipmentId),
  ]);
  return { dailyLogActivities, tankLabelSuggestions };
}

export async function getEquipmentFuelFilterOptions() {
  const [equipment, people] = await Promise.all([
    prisma.equipment.findMany({
      select: { id: true, displayName: true, equipmentNumber: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.fuelServicePerson.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);
  return { equipment, people };
}

type FuelEventDetail = NonNullable<Awaited<ReturnType<typeof getEquipmentFuelEventById>>>;

export function equipmentFuelEventToFormInitial(event: FuelEventDetail): EquipmentFuelEventFormInitialValues {
  return {
    operationalWorkDate: event.operationalWorkDate.toISOString().slice(0, 10),
    eventTime: event.eventTime,
    equipmentId: event.equipmentId ?? "",
    fuelType: event.fuelType,
    fuelServicePersonId: event.fuelServicePersonId ?? "",
    dailyLogActivityId: event.dailyLogActivityId ?? "",
    notes: event.notes ?? "",
    tankFills: event.tankFills.map((fill) => ({
      sequence: fill.sequence,
      tankLabel: fill.tankLabel,
      gallons: String(fill.gallons),
    })),
  };
}
