import type { Prisma, TimesheetStatus } from "@prisma/client";

import { parseDateOnly } from "./calculations";

export type TimesheetSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type TimesheetHistoryFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: TimesheetStatus;
  equipmentId?: string;
  workCodeId?: string;
  workOrderId?: string;
  supportPersonId?: string;
  hasOvertime?: true;
  page: number;
};

export type ParsedTimesheetHistoryFilters = {
  filters: TimesheetHistoryFilters;
  ignoredInvalidParameters: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const integerPattern = /^\d+$/;
const statusValues = new Set<TimesheetStatus>(["DRAFT", "COMPLETED"]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function trimmedValue(value: string | string[] | undefined) {
  const first = firstValue(value);
  if (first === undefined) {
    return undefined;
  }

  const trimmed = first.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRealDateOnly(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

export function parseTimesheetHistoryFilters(
  searchParams: TimesheetSearchParams,
): ParsedTimesheetHistoryFilters {
  let ignoredInvalidParameters = false;
  const filters: TimesheetHistoryFilters = { page: 1 };

  const dateFrom = trimmedValue(searchParams.dateFrom);
  if (dateFrom) {
    if (isRealDateOnly(dateFrom)) {
      filters.dateFrom = dateFrom;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  const dateTo = trimmedValue(searchParams.dateTo);
  if (dateTo) {
    if (isRealDateOnly(dateTo)) {
      filters.dateTo = dateTo;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  const status = trimmedValue(searchParams.status);
  if (status) {
    if (statusValues.has(status as TimesheetStatus)) {
      filters.status = status as TimesheetStatus;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  for (const key of [
    "equipmentId",
    "workCodeId",
    "workOrderId",
    "supportPersonId",
  ] as const) {
    const value = trimmedValue(searchParams[key]);
    if (value) {
      filters[key] = value;
    }
  }

  const hasOvertime = trimmedValue(searchParams.hasOvertime);
  if (hasOvertime) {
    if (hasOvertime === "true") {
      filters.hasOvertime = true;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  const page = trimmedValue(searchParams.page);
  if (page) {
    const parsed = Number(page);
    if (
      integerPattern.test(page) &&
      Number.isSafeInteger(parsed) &&
      parsed > 0
    ) {
      filters.page = parsed;
    } else {
      ignoredInvalidParameters = true;
    }
  }

  return { filters, ignoredInvalidParameters };
}

export function hasTimesheetHistoryFilters(filters: TimesheetHistoryFilters) {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.status ||
      filters.equipmentId ||
      filters.workCodeId ||
      filters.workOrderId ||
      filters.supportPersonId ||
      filters.hasOvertime,
  );
}

export function buildTimesheetHistoryWhere(
  filters: TimesheetHistoryFilters,
): Prisma.WeeklyTimesheetWhereInput {
  const and: Prisma.WeeklyTimesheetWhereInput[] = [];

  if (
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  ) {
    const boundary = parseDateOnly(filters.dateFrom);
    and.push(
      { payrollWeekStartDate: { gte: boundary } },
      { payrollWeekStartDate: { lt: boundary } },
    );
  } else {
    if (filters.dateFrom) {
      and.push({
        payrollWeekEndDate: { gte: parseDateOnly(filters.dateFrom) },
      });
    }
    if (filters.dateTo) {
      and.push({
        payrollWeekStartDate: { lte: parseDateOnly(filters.dateTo) },
      });
    }
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.hasOvertime) {
    and.push({ overtimeMinutesTotal: { gt: 0 } });
  }

  const allocation: Prisma.WorkAllocationWhereInput = {};
  if (filters.workCodeId) {
    allocation.workCodeId = filters.workCodeId;
  }
  if (filters.workOrderId) {
    allocation.workOrderId = filters.workOrderId;
  }
  if (filters.supportPersonId) {
    allocation.supportPersonnel = {
      some: { supportPersonId: filters.supportPersonId },
    };
  }

  const hasAllocationFilters = Object.keys(allocation).length > 0;
  if (filters.equipmentId || hasAllocationFilters) {
    const entry: Prisma.DailyTimeEntryWhereInput = {};
    if (filters.equipmentId) {
      entry.primaryEquipmentId = filters.equipmentId;
    }
    if (hasAllocationFilters) {
      entry.allocations = { some: allocation };
    }
    and.push({ entries: { some: entry } });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function timesheetHistoryPageHref(
  filters: TimesheetHistoryFilters,
  page: number,
) {
  const params = new URLSearchParams();

  for (const key of [
    "dateFrom",
    "dateTo",
    "status",
    "equipmentId",
    "workCodeId",
    "workOrderId",
    "supportPersonId",
  ] as const) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }

  if (filters.hasOvertime) {
    params.set("hasOvertime", "true");
  }
  const normalizedPage =
    Number.isSafeInteger(page) && page > 0 ? page : 1;
  params.set("page", String(normalizedPage));

  return `/timesheets?${params.toString()}`;
}
