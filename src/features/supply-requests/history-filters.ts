import type { Prisma, SupplyRequestStatus } from "@prisma/client";

import { normalizeSupplyItemNumberKey } from "./normalization";
import { isCanonicalSupplyRequestDate } from "./validation";

export const supplyRequestHistoryParameterNames = [
  "dateFrom",
  "dateTo",
  "status",
  "equipmentId",
  "supervisorId",
  "reference",
  "item",
  "notes",
  "page",
] as const;

export type SupplyRequestHistoryParameterName =
  (typeof supplyRequestHistoryParameterNames)[number];
export type SupplyRequestHistorySearchParams = Record<
  string,
  string | string[] | undefined
>;
export type SupplyRequestHistoryFilters = Readonly<{
  dateFrom?: string;
  dateTo?: string;
  status?: SupplyRequestStatus;
  equipmentId?: string;
  supervisorId?: string;
  reference?: string;
  item?: string;
  notes?: string;
  page: number;
}>;
export type ParsedSupplyRequestHistoryFilters = Readonly<{
  filters: SupplyRequestHistoryFilters;
  invalidParameters: readonly string[];
}>;

const supported = new Set<string>(supplyRequestHistoryParameterNames);
const statuses = new Set<SupplyRequestStatus>([
  "REQUESTED",
  "FULFILLED",
  "CANCELLED",
]);
const positiveIntegerPattern = /^[1-9]\d*$/;

function first(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function normalized(value: unknown) {
  const candidate = first(value);
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed || undefined;
}

export function parseSupplyRequestHistoryFilters(
  searchParams: SupplyRequestHistorySearchParams,
): ParsedSupplyRequestHistoryFilters {
  const invalid = new Set<string>();
  const parsed: {
    dateFrom?: string;
    dateTo?: string;
    status?: SupplyRequestStatus;
    equipmentId?: string;
    supervisorId?: string;
    reference?: string;
    item?: string;
    notes?: string;
    page: number;
  } = { page: 1 };

  if (Object.keys(searchParams).some((key) => !supported.has(key))) {
    invalid.add("unsupported parameters");
  }

  for (const key of ["dateFrom", "dateTo"] as const) {
    const value = normalized(searchParams[key]);
    if (value === null) invalid.add(key);
    if (value) {
      if (isCanonicalSupplyRequestDate(value)) parsed[key] = value;
      else invalid.add(key);
    }
  }

  const status = normalized(searchParams.status);
  if (status === null) invalid.add("status");
  if (status) {
    if (statuses.has(status as SupplyRequestStatus)) {
      parsed.status = status as SupplyRequestStatus;
    } else invalid.add("status");
  }

  for (const key of ["equipmentId", "supervisorId"] as const) {
    const value = normalized(searchParams[key]);
    if (value === null) invalid.add(key);
    if (value) {
      if (value.length <= 100) parsed[key] = value;
      else invalid.add(key);
    }
  }

  const reference = normalized(searchParams.reference);
  if (reference === null) invalid.add("reference");
  if (reference) {
    if (reference.length <= 50) parsed.reference = reference.toUpperCase();
    else invalid.add("reference");
  }

  for (const key of ["item", "notes"] as const) {
    const value = normalized(searchParams[key]);
    if (value === null) invalid.add(key);
    if (value) {
      if (value.length <= 200) parsed[key] = value;
      else invalid.add(key);
    }
  }

  const page = normalized(searchParams.page);
  if (page === null) invalid.add("page");
  if (page) {
    const value = Number(page);
    if (
      positiveIntegerPattern.test(page) &&
      Number.isSafeInteger(value) &&
      value > 0
    ) {
      parsed.page = value;
    } else invalid.add("page");
  }

  return { filters: parsed, invalidParameters: [...invalid].slice(0, 10) };
}

export function hasSupplyRequestHistoryFilters(
  filters: SupplyRequestHistoryFilters,
) {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.status ||
      filters.equipmentId ||
      filters.supervisorId ||
      filters.reference ||
      filters.item ||
      filters.notes,
  );
}

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function buildSupplyRequestHistoryWhere(
  filters: SupplyRequestHistoryFilters,
): Prisma.SupplyRequestWhereInput {
  const current: Prisma.SupplyRequestVersionWhereInput = {};
  if (filters.dateFrom || filters.dateTo) {
    current.operationalWorkDate = {
      ...(filters.dateFrom ? { gte: dateOnly(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: dateOnly(filters.dateTo) } : {}),
    };
  }
  if (filters.status) current.status = filters.status;
  if (filters.equipmentId) current.equipmentId = filters.equipmentId;
  if (filters.supervisorId) current.supervisorId = filters.supervisorId;
  if (filters.notes) {
    current.notes = { contains: filters.notes, mode: "insensitive" };
  }
  if (filters.item) {
    current.items = {
      some: {
        OR: [
          {
            normalizedItemNumberSnapshot: {
              contains: normalizeSupplyItemNumberKey(filters.item),
            },
          },
          {
            descriptionSnapshot: {
              contains: filters.item,
              mode: "insensitive",
            },
          },
        ],
      },
    };
  }

  const and: Prisma.SupplyRequestWhereInput[] = [
    { currentVersion: { is: current } },
  ];
  if (filters.reference) and.push({ namReference: filters.reference });
  return { AND: and };
}

export function supplyRequestHistoryPageHref(
  filters: SupplyRequestHistoryFilters,
  page: number,
) {
  const params = new URLSearchParams();
  for (const key of [
    "dateFrom",
    "dateTo",
    "status",
    "equipmentId",
    "supervisorId",
    "reference",
    "item",
    "notes",
  ] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  params.set(
    "page",
    String(Number.isSafeInteger(page) && page > 0 ? page : 1),
  );
  return `/supply-requests?${params.toString()}`;
}
