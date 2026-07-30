import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  supplyRequestReferencePageSize,
  type SupplyRequestReferenceFilters,
} from "./reference-filters";
import { normalizeSupplyItemNumberKey } from "./normalization";
import { normalizeReferenceIdForLookup } from "./reference-validation";

function activeWhere(status: SupplyRequestReferenceFilters["status"]) {
  if (status === "active") return true;
  if (status === "inactive") return false;
  return undefined;
}

export async function getSupplyItemManagementList(
  filters: SupplyRequestReferenceFilters,
) {
  const where: Prisma.SupplyItemWhereInput = {};
  const active = activeWhere(filters.status);
  if (active !== undefined) where.active = active;
  if (filters.q) {
    where.OR = [
      {
        normalizedItemNumber: {
          contains: normalizeSupplyItemNumberKey(filters.q),
        },
      },
      { itemNumber: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  const [matchingCount, totalCount] = await Promise.all([
    prisma.supplyItem.count({ where }),
    prisma.supplyItem.count(),
  ]);
  const requestedOffset =
    BigInt(filters.page - 1) * BigInt(supplyRequestReferencePageSize);
  const records =
    requestedOffset < BigInt(matchingCount)
      ? await prisma.supplyItem.findMany({
          where,
          select: {
            id: true,
            itemNumber: true,
            description: true,
            unitOfMeasure: true,
            active: true,
            _count: { select: { versionItems: true } },
          },
          orderBy: [{ active: "desc" }, { itemNumber: "asc" }, { id: "asc" }],
          skip: Number(requestedOffset),
          take: supplyRequestReferencePageSize,
        })
      : [];

  return {
    items: records.map((record) => ({
      id: record.id,
      itemNumber: record.itemNumber,
      description: record.description,
      unit: record.unitOfMeasure,
      active: record.active,
      historicalUseCount: record._count.versionItems,
    })),
    matchingCount,
    totalCount,
    page: filters.page,
    hasPreviousPage: filters.page > 1,
    hasNextPage:
      filters.page * supplyRequestReferencePageSize < matchingCount,
  };
}

export async function getSupplyItemForEdit(idInput: unknown) {
  const id = normalizeReferenceIdForLookup(idInput);
  if (!id) return null;
  const record = await prisma.supplyItem.findUnique({
    where: { id },
    select: {
      id: true,
      itemNumber: true,
      description: true,
      unitOfMeasure: true,
      active: true,
      _count: { select: { versionItems: true } },
    },
  });
  return record
    ? {
        id: record.id,
        itemNumber: record.itemNumber,
        description: record.description,
        unitOfMeasure: record.unitOfMeasure,
        active: record.active,
        historicalUseCount: record._count.versionItems,
      }
    : null;
}

export async function getSupervisorManagementList(
  filters: SupplyRequestReferenceFilters,
) {
  const where: Prisma.SupplyRequestSupervisorWhereInput = {};
  const active = activeWhere(filters.status);
  if (active !== undefined) where.active = active;
  if (filters.q) {
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
      {
        normalizedEmail: {
          contains: filters.q.toLowerCase(),
        },
      },
    ];
  }

  const [matchingCount, totalCount] = await Promise.all([
    prisma.supplyRequestSupervisor.count({ where }),
    prisma.supplyRequestSupervisor.count(),
  ]);
  const requestedOffset =
    BigInt(filters.page - 1) * BigInt(supplyRequestReferencePageSize);
  const records =
    requestedOffset < BigInt(matchingCount)
      ? await prisma.supplyRequestSupervisor.findMany({
          where,
          select: {
            id: true,
            fullName: true,
            email: true,
            active: true,
            _count: { select: { versions: true } },
          },
          orderBy: [{ active: "desc" }, { fullName: "asc" }, { id: "asc" }],
          skip: Number(requestedOffset),
          take: supplyRequestReferencePageSize,
        })
      : [];

  return {
    items: records.map((record) => ({
      id: record.id,
      fullName: record.fullName,
      email: record.email,
      active: record.active,
      historicalUseCount: record._count.versions,
    })),
    matchingCount,
    totalCount,
    page: filters.page,
    hasPreviousPage: filters.page > 1,
    hasNextPage:
      filters.page * supplyRequestReferencePageSize < matchingCount,
  };
}

export async function getSupervisorForEdit(idInput: unknown) {
  const id = normalizeReferenceIdForLookup(idInput);
  if (!id) return null;
  const record = await prisma.supplyRequestSupervisor.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      active: true,
      _count: { select: { versions: true } },
    },
  });
  return record
    ? {
        id: record.id,
        fullName: record.fullName,
        email: record.email,
        active: record.active,
        historicalUseCount: record._count.versions,
      }
    : null;
}
