import type { Prisma } from "@prisma/client";

import {
  dailyLogActivityTypeValues,
  shiftValues,
  type DailyLogActivityTypeValue,
  type ShiftValue,
} from "./constants";

export type DailyLogSearchParams = Record<string, string | string[] | undefined>;

export type DailyLogFilters = {
  activityType?: DailyLogActivityTypeValue;
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  mineId?: string;
  q?: string;
  shift?: ShiftValue;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dailyLogsPath = "/daily-logs";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanValue(value: string | string[] | undefined) {
  const first = firstValue(value);

  if (!first) {
    return undefined;
  }

  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isShiftValue(value: string): value is ShiftValue {
  return shiftValues.includes(value as ShiftValue);
}

function isActivityTypeValue(value: string): value is DailyLogActivityTypeValue {
  return dailyLogActivityTypeValues.includes(value as DailyLogActivityTypeValue);
}

function cleanDate(value: string | string[] | undefined) {
  const cleaned = cleanValue(value);

  if (!cleaned || !datePattern.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function contains(value: string) {
  return {
    contains: value,
    mode: "insensitive" as const,
  };
}

function activityContains(value: string) {
  return {
    contains: value,
    mode: "insensitive" as const,
  };
}

export function parseDailyLogFilters(searchParams: DailyLogSearchParams): DailyLogFilters {
  const shift = cleanValue(searchParams.shift);
  const activityType = cleanValue(searchParams.activityType);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    mineId: cleanValue(searchParams.mineId),
    equipmentId: cleanValue(searchParams.equipmentId),
    shift: shift && isShiftValue(shift) ? shift : undefined,
    activityType:
      activityType && isActivityTypeValue(activityType) ? activityType : undefined,
  };
}

export function hasDailyLogFilters(filters: DailyLogFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function selectedDailyLogDate(filters: DailyLogFilters, today: string) {
  return filters.dateFrom && filters.dateFrom === filters.dateTo ? filters.dateFrom : today;
}

export function todayDateValue(now = new Date()) {
  return dateValue(now);
}

export function shiftDailyLogDate(value: string, days: number) {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateValue(date);
}

export function dailyLogFilterHref(
  filters: DailyLogFilters,
  updates: Partial<DailyLogFilters>,
) {
  const nextFilters: DailyLogFilters = {
    ...filters,
    ...updates,
  };
  const params = new URLSearchParams();

  Object.entries(nextFilters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${dailyLogsPath}?${query}` : dailyLogsPath;
}

export function buildDailyLogWhere(filters: DailyLogFilters): Prisma.DailyLogWhereInput {
  const and: Prisma.DailyLogWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);
    const activityTextFilter = activityContains(filters.q);

    and.push({
      OR: [
        { summary: textFilter },
        { weatherConditions: textFilter },
        { generalNotes: textFilter },
        { mine: { name: textFilter } },
        { mine: { city: { name: textFilter } } },
        { primaryEquipment: { displayName: textFilter } },
        { primaryEquipment: { equipmentNumber: textFilter } },
        {
          activities: {
            some: {
              OR: [
                { title: activityTextFilter },
                { description: activityTextFilter },
                { location: activityTextFilter },
                { contractorCompany: activityTextFilter },
                { personName: activityTextFilter },
                { notes: activityTextFilter },
                { equipment: { displayName: activityTextFilter } },
                { equipment: { equipmentNumber: activityTextFilter } },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      logDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }

  if (filters.shift) {
    and.push({ shift: filters.shift });
  }

  if (filters.mineId) {
    and.push({ mineId: filters.mineId });
  }

  if (filters.equipmentId) {
    and.push({
      OR: [
        { primaryEquipmentId: filters.equipmentId },
        { activities: { some: { equipmentId: filters.equipmentId } } },
      ],
    });
  }

  if (filters.activityType) {
    and.push({
      activities: {
        some: {
          activityType: filters.activityType,
        },
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}
