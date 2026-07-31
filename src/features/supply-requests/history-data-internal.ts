import type { Prisma, PrismaClient } from "@prisma/client";

import { supplyRequestHistoryPageSize } from "./constants";
import {
  buildSupplyRequestHistoryWhere,
  hasSupplyRequestHistoryFilters,
  type SupplyRequestHistoryFilters,
} from "./history-filters";
import type {
  SupplyRequestHistoryFilterOption,
  SupplyRequestHistoryPageData,
  SupplyRequestHistoryRow,
} from "./history-types";
import {
  supplyRequestEquipmentSnapshotLabel,
  supplyRequestStatusLabel,
} from "./surface-display";
import {
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
} from "./validation";

export const currentVersionRowSelect = {
  id: true,
  supplyRequestId: true,
  versionNumber: true,
  changeKind: true,
  status: true,
  operationalWorkDate: true,
  submittedLocalDate: true,
  submittedLocalTime: true,
  equipmentDisplayNameSnapshot: true,
  equipmentNumberSnapshot: true,
  equipmentCategorySnapshot: true,
  mineNameSnapshot: true,
  cityNameSnapshot: true,
  cityStateSnapshot: true,
  requesterDisplayNameSnapshot: true,
  requesterEmployeeNumberSnapshot: true,
  supervisorNameSnapshot: true,
  supervisorEmailSnapshot: true,
  notes: true,
  fulfillmentOperationalWorkDate: true,
  fulfilledLocalDate: true,
  fulfilledLocalTime: true,
  fulfillmentNote: true,
  cancelledLocalDate: true,
  cancelledLocalTime: true,
  cancellationReason: true,
  correctionReason: true,
  correctedByDisplayNameSnapshot: true,
  correctionLocalDate: true,
  correctionLocalTime: true,
  _count: { select: { items: true } },
} satisfies Prisma.SupplyRequestVersionSelect;

export type CurrentVersionRow = Prisma.SupplyRequestVersionGetPayload<{
  select: typeof currentVersionRowSelect;
}>;

function dateKey(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;
  const key = value.toISOString().slice(0, 10);
  return isCanonicalSupplyRequestDate(key) ? key : null;
}

function usable(value: unknown, maximum?: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (maximum === undefined || value.trim().length <= maximum)
  );
}

function currentRowIsCoherent(version: CurrentVersionRow) {
  const operational = dateKey(version.operationalWorkDate);
  const submitted = dateKey(version.submittedLocalDate);
  if (
    !Number.isSafeInteger(version.versionNumber) ||
    version.versionNumber < 1 ||
    version.versionNumber > 2_147_483_647 ||
    !operational ||
    !submitted ||
    !isCanonicalSupplyRequestLocalTime(version.submittedLocalTime) ||
    !usable(version.equipmentDisplayNameSnapshot) ||
    !usable(version.mineNameSnapshot) ||
    !usable(version.cityNameSnapshot) ||
    !usable(version.requesterDisplayNameSnapshot) ||
    !usable(version.requesterEmployeeNumberSnapshot) ||
    !usable(version.supervisorNameSnapshot) ||
    !usable(version.supervisorEmailSnapshot) ||
    (version.notes !== null && !usable(version.notes, 2_000)) ||
    version._count.items < 1 ||
    version._count.items > 50
  ) {
    return false;
  }

  const fulfillmentDate = dateKey(version.fulfillmentOperationalWorkDate);
  const fulfilledDate = dateKey(version.fulfilledLocalDate);
  const cancelledDate = dateKey(version.cancelledLocalDate);
  const anyFulfillment =
    version.fulfillmentOperationalWorkDate !== null ||
    version.fulfilledLocalDate !== null ||
    version.fulfilledLocalTime !== null ||
    version.fulfillmentNote !== null;
  const completeFulfillment =
    fulfillmentDate !== null &&
    fulfilledDate !== null &&
    version.fulfilledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.fulfilledLocalTime) &&
    fulfillmentDate >= operational &&
    `${fulfilledDate}T${version.fulfilledLocalTime}` >=
      `${submitted}T${version.submittedLocalTime}` &&
    (version.fulfillmentNote === null ||
      usable(version.fulfillmentNote, 1_000));
  const anyCancellation =
    version.cancelledLocalDate !== null ||
    version.cancelledLocalTime !== null ||
    version.cancellationReason !== null;
  const completeCancellation =
    cancelledDate !== null &&
    version.cancelledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.cancelledLocalTime) &&
    `${cancelledDate}T${version.cancelledLocalTime}` >=
      `${submitted}T${version.submittedLocalTime}` &&
    (version.cancellationReason === null ||
      usable(version.cancellationReason, 1_000));
  const anyCorrection =
    version.correctionReason !== null ||
    version.correctedByDisplayNameSnapshot !== null ||
    version.correctionLocalDate !== null ||
    version.correctionLocalTime !== null;
  const completeCorrection =
    usable(version.correctionReason, 1_000) &&
    usable(version.correctedByDisplayNameSnapshot) &&
    dateKey(version.correctionLocalDate) !== null &&
    version.correctionLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.correctionLocalTime);
  const correctionCoherent =
    version.changeKind === "CORRECTED" ? completeCorrection : !anyCorrection;

  if (!correctionCoherent) return false;
  if (version.status === "REQUESTED") {
    return (
      (version.changeKind === "CREATED" ||
        version.changeKind === "CORRECTED") &&
      !anyFulfillment &&
      !anyCancellation
    );
  }
  if (version.status === "FULFILLED") {
    return (
      (version.changeKind === "FULFILLED" ||
        version.changeKind === "CORRECTED") &&
      completeFulfillment &&
      !anyCancellation
    );
  }
  return (
    version.status === "CANCELLED" &&
    (version.changeKind === "CANCELLED" ||
      version.changeKind === "CORRECTED") &&
    completeCancellation &&
    !anyFulfillment
  );
}

export function mapRow(root: {
  id: string;
  namReference: string;
  currentVersionId: string | null;
  currentVersion: CurrentVersionRow | null;
}): SupplyRequestHistoryRow {
  const version = root.currentVersion;
  if (
    !usable(root.id, 100) ||
    !usable(root.namReference, 50) ||
    !root.currentVersionId ||
    !version ||
    version.id !== root.currentVersionId ||
    version.supplyRequestId !== root.id ||
    !currentRowIsCoherent(version)
  ) {
    throw new Error("Invalid persisted Supply Request current aggregate.");
  }
  const operationalWorkDate = dateKey(version.operationalWorkDate);
  const submittedLocalDate = dateKey(version.submittedLocalDate);
  if (!operationalWorkDate || !submittedLocalDate) {
    throw new Error("Invalid persisted Supply Request current aggregate.");
  }
  return {
    supplyRequestId: root.id,
    namReference: root.namReference,
    versionNumber: version.versionNumber,
    status: version.status,
    statusLabel: supplyRequestStatusLabel(version.status),
    operationalWorkDate,
    submittedLocalDate,
    submittedLocalTime: version.submittedLocalTime,
    equipmentLabel: supplyRequestEquipmentSnapshotLabel(
      version.equipmentDisplayNameSnapshot,
      version.equipmentNumberSnapshot,
    ),
    equipmentNumber: version.equipmentNumberSnapshot,
    mineName: version.mineNameSnapshot,
    cityLabel: `${version.cityNameSnapshot}${
      version.cityStateSnapshot ? `, ${version.cityStateSnapshot}` : ""
    }`,
    supervisorName: version.supervisorNameSnapshot,
    itemCount: version._count.items,
    detailHref: `/supply-requests/${encodeURIComponent(root.id)}`,
  };
}

async function equipmentOptions(
  transaction: Prisma.TransactionClient,
): Promise<readonly SupplyRequestHistoryFilterOption[]> {
  const records = await transaction.equipment.findMany({
    where: {
      OR: [
        { status: "ACTIVE" },
        {
          supplyRequestVersions: {
            some: { currentForRequest: { isNot: null } },
          },
        },
      ],
    },
    select: { id: true, displayName: true, equipmentNumber: true, status: true },
    orderBy: [{ displayName: "asc" }, { equipmentNumber: "asc" }, { id: "asc" }],
  });
  return records.map((record) => ({
    id: record.id,
    label: supplyRequestEquipmentSnapshotLabel(
      record.displayName,
      record.equipmentNumber,
    ),
    active: record.status === "ACTIVE",
  }));
}

async function supervisorOptions(
  transaction: Prisma.TransactionClient,
): Promise<readonly SupplyRequestHistoryFilterOption[]> {
  const records = await transaction.supplyRequestSupervisor.findMany({
    where: {
      OR: [
        { active: true },
        { versions: { some: { currentForRequest: { isNot: null } } } },
      ],
    },
    select: { id: true, fullName: true, email: true, active: true },
    orderBy: [{ fullName: "asc" }, { email: "asc" }, { id: "asc" }],
  });
  return records.map((record) => ({
    id: record.id,
    label: `${record.fullName} · ${record.email}`,
    active: record.active,
  }));
}

export async function getSupplyRequestHistoryPageWithClient(
  client: PrismaClient,
  filters: SupplyRequestHistoryFilters,
): Promise<SupplyRequestHistoryPageData> {
  return client.$transaction(
    async (transaction) => {
      const where = buildSupplyRequestHistoryWhere(filters);
      const totalWhere: Prisma.SupplyRequestWhereInput = {
        currentVersion: { is: {} },
      };
      const filtersActive = hasSupplyRequestHistoryFilters(filters);
      const matchingCount = await transaction.supplyRequest.count({ where });
      const invalidCurrentRoot = await transaction.supplyRequest.findFirst({
        where: { currentVersionId: null },
        select: { id: true },
      });
      if (invalidCurrentRoot) {
        throw new Error("Invalid persisted Supply Request current aggregate.");
      }
      const totalCount = filtersActive
        ? await transaction.supplyRequest.count({ where: totalWhere })
        : matchingCount;
      const offset =
        BigInt(filters.page - 1) * BigInt(supplyRequestHistoryPageSize);
      const records =
        offset < BigInt(matchingCount)
          ? await transaction.supplyRequest.findMany({
              where,
              select: {
                id: true,
                namReference: true,
                currentVersionId: true,
                currentVersion: { select: currentVersionRowSelect },
              },
              orderBy: [
                { currentVersion: { operationalWorkDate: "desc" } },
                { currentVersion: { submittedLocalDate: "desc" } },
                { currentVersion: { submittedLocalTime: "desc" } },
                { namReference: "desc" },
                { id: "desc" },
              ],
              skip: Number(offset),
              take: supplyRequestHistoryPageSize,
            })
          : [];
      const [equipment, supervisors] = await Promise.all([
        equipmentOptions(transaction),
        supervisorOptions(transaction),
      ]);
      return {
        status: "ready",
        rows: records.map(mapRow),
        equipmentOptions: equipment,
        supervisorOptions: supervisors,
        totalCount,
        matchingCount,
        page: filters.page,
        hasPreviousPage: filters.page > 1,
        hasNextPage:
          offset + BigInt(supplyRequestHistoryPageSize) < BigInt(matchingCount),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
