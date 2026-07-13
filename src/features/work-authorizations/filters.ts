import type { Prisma } from "@prisma/client";

import {
  workAuthorizationStatusValues,
  workAuthorizationWorkTypeValues,
} from "./constants";

export type WorkAuthorizationSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type WorkAuthorizationStatusValue =
  (typeof workAuthorizationStatusValues)[number];
export type WorkAuthorizationWorkTypeValue =
  (typeof workAuthorizationWorkTypeValues)[number];

export type WorkAuthorizationFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  q?: string;
  status?: WorkAuthorizationStatusValue;
  workType?: WorkAuthorizationWorkTypeValue;
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

function isStatusValue(value: string): value is WorkAuthorizationStatusValue {
  return workAuthorizationStatusValues.includes(
    value as WorkAuthorizationStatusValue,
  );
}

function isWorkTypeValue(value: string): value is WorkAuthorizationWorkTypeValue {
  return workAuthorizationWorkTypeValues.includes(
    value as WorkAuthorizationWorkTypeValue,
  );
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

export function parseWorkAuthorizationFilters(
  searchParams: WorkAuthorizationSearchParams,
): WorkAuthorizationFilters {
  const status = cleanValue(searchParams.status);
  const workType = cleanValue(searchParams.workType);

  return {
    q: cleanValue(searchParams.q),
    dateFrom: cleanDate(searchParams.dateFrom),
    dateTo: cleanDate(searchParams.dateTo),
    equipmentId: cleanValue(searchParams.equipmentId),
    status: status && isStatusValue(status) ? status : undefined,
    workType: workType && isWorkTypeValue(workType) ? workType : undefined,
  };
}

export function hasWorkAuthorizationFilters(filters: WorkAuthorizationFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function buildWorkAuthorizationWhere(
  filters: WorkAuthorizationFilters,
): Prisma.WorkAuthorizationWhereInput {
  const and: Prisma.WorkAuthorizationWhereInput[] = [];

  if (filters.q) {
    const textFilter = contains(filters.q);

    and.push({
      OR: [
        { workDescription: textFilter },
        { jobLocation: textFilter },
        { contactName: textFilter },
        { equipmentRequired: textFilter },
        { personInChargeName: textFilter },
        { lockoutNotRequiredReason: textFilter },
        { completionNotes: textFilter },
        { equipment: { displayName: textFilter } },
        { equipment: { equipmentNumber: textFilter } },
      ],
    });
  }

  if (filters.dateFrom || filters.dateTo) {
    and.push({
      shiftReport: {
        reportDate: {
          ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
        },
      },
    });
  }

  if (filters.equipmentId) {
    and.push({ equipmentId: filters.equipmentId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.workType) {
    and.push({ workType: filters.workType });
  }

  return and.length > 0 ? { AND: and } : {};
}
