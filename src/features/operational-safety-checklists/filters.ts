import type { Prisma } from "@prisma/client";

import { safetyChecklistShiftValues } from "./constants";
import { isSafetyChecklistDateOnly } from "./date";
import {
  safetyChecklistResponseCodeValues,
  safetyChecklistTemplateKeys,
  type SafetyChecklistResponseCode,
  type SafetyChecklistTemplateKey,
} from "./templates";

export type SafetyChecklistSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type SafetyChecklistFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  template?: SafetyChecklistTemplateKey;
  shift?: (typeof safetyChecklistShiftValues)[number];
  operator?: string;
  supervisor?: string;
  condition?: SafetyChecklistResponseCode;
};

function clean(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  return trimmed || undefined;
}

function cleanDate(value: string | string[] | undefined) {
  const result = clean(value);
  return result && isSafetyChecklistDateOnly(result) ? result : undefined;
}

function oneOf<const T extends readonly string[]>(value: string | undefined, values: T) {
  return value && values.includes(value) ? (value as T[number]) : undefined;
}

export function parseSafetyChecklistFilters(
  searchParams: SafetyChecklistSearchParams,
): SafetyChecklistFilters {
  return {
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: clean(searchParams.equipmentId),
    template: oneOf(clean(searchParams.template), safetyChecklistTemplateKeys),
    shift: oneOf(clean(searchParams.shift), safetyChecklistShiftValues),
    operator: clean(searchParams.operator),
    supervisor: clean(searchParams.supervisor),
    condition: oneOf(
      clean(searchParams.condition),
      safetyChecklistResponseCodeValues,
    ),
  };
}

export function hasSafetyChecklistFilters(filters: SafetyChecklistFilters) {
  return Object.values(filters).some(Boolean);
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function buildSafetyChecklistWhere(
  filters: SafetyChecklistFilters,
): Prisma.OperationalSafetyChecklistWhereInput {
  const and: Prisma.OperationalSafetyChecklistWhereInput[] = [];
  if (filters.dateFrom || filters.dateTo) {
    and.push({
      inspectionDate: {
        ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
      },
    });
  }
  if (filters.equipmentId) and.push({ equipmentId: filters.equipmentId });
  if (filters.template) and.push({ templateKey: filters.template });
  if (filters.shift) and.push({ shift: filters.shift });
  if (filters.operator) {
    and.push({ operatorDisplayName: { contains: filters.operator, mode: "insensitive" } });
  }
  if (filters.supervisor) {
    and.push({
      supervisorDisplayName: { contains: filters.supervisor, mode: "insensitive" },
    });
  }
  if (filters.condition) {
    and.push({ responses: { some: { responseCode: filters.condition } } });
  }
  return and.length ? { AND: and } : {};
}
