import type { Prisma } from "@prisma/client";

import {
  defectPriorityValues,
  defectSeverityValues,
  defectStatusValues,
  type DefectStatusValue,
} from "./constants";

export type DefectSearchParams = Record<string, string | string[] | undefined>;

export type DefectSeverityValue = (typeof defectSeverityValues)[number];
export type DefectPriorityValue = (typeof defectPriorityValues)[number];

export type DefectFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  priority?: DefectPriorityValue;
  q?: string;
  severity?: DefectSeverityValue;
  status?: DefectStatusValue;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

function cleanDate(value: string | string[] | undefined) {
  const cleaned = cleanValue(value);

  if (!cleaned || !datePattern.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function isStatusValue(value: string): value is DefectStatusValue {
  return defectStatusValues.includes(value as DefectStatusValue);
}

function isSeverityValue(value: string): value is DefectSeverityValue {
  return defectSeverityValues.includes(value as DefectSeverityValue);
}

function isPriorityValue(value: string): value is DefectPriorityValue {
  return defectPriorityValues.includes(value as DefectPriorityValue);
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function contains(value: string) {
  return {
    contains: value,
    mode: "insensitive" as const,
  };
}

export function parseDefectFilters(searchParams: DefectSearchParams): DefectFilters {
  const status = cleanValue(searchParams.status);
  const severity = cleanValue(searchParams.severity);
  const priority = cleanValue(searchParams.priority);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: cleanValue(searchParams.equipmentId),
    status: status && isStatusValue(status) ? status : undefined,
    severity: severity && isSeverityValue(severity) ? severity : undefined,
    priority: priority && isPriorityValue(priority) ? priority : undefined,
  };
}

export function hasDefectFilters(filters: DefectFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function buildDefectWhere(filters: DefectFilters): Prisma.DefectWhereInput {
  const and: Prisma.DefectWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);

    and.push({
      OR: [
        { title: textFilter },
        { description: textFilter },
        { correctiveAction: textFilter },
        { resolutionSummary: textFilter },
        { equipment: { displayName: textFilter } },
        { equipment: { equipmentNumber: textFilter } },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      reportedDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }

  if (filters.equipmentId) {
    and.push({ equipmentId: filters.equipmentId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.severity) {
    and.push({ severity: filters.severity });
  }

  if (filters.priority) {
    and.push({ priority: filters.priority });
  }

  return and.length > 0 ? { AND: and } : {};
}
