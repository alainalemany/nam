import type { Prisma, PrismaClient } from "@prisma/client";

import { normalizeSupplyItemNumberKey } from "./normalization";
import {
  formatSupplyRequestRecordedAt,
  supplyRequestEquipmentSnapshotLabel,
} from "./surface-display";
import type {
  SupplyRequestCreatePageData,
  SupplyRequestDetailView,
} from "./surface-types";
import {
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
} from "./validation";
import {
  parseSupplyRequestOriginalVersion,
  parseSupplyRequestRouteId,
  parseSupplyRequestSearchQuery,
} from "./surface-validation";

export const supplyRequestOptionLimit = 20;

const versionSelect = {
  id: true,
  supplyRequestId: true,
  versionNumber: true,
  changeKind: true,
  status: true,
  operationalWorkDate: true,
  submittedLocalDate: true,
  submittedLocalTime: true,
  equipmentId: true,
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
  createdAt: true,
  equipment: { select: { id: true } },
  items: {
    select: {
      id: true,
      sequence: true,
      itemNumberSnapshot: true,
      descriptionSnapshot: true,
      quantity: true,
      unitOfMeasureSnapshot: true,
    },
    orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.SupplyRequestVersionSelect;

function dateKey(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;
  const key = value.toISOString().slice(0, 10);
  return isCanonicalSupplyRequestDate(key) ? key : null;
}

function lifecycleFieldsAreCoherent(
  version: Prisma.SupplyRequestVersionGetPayload<{
    select: typeof versionSelect;
  }>,
) {
  const operationalWorkDate = dateKey(version.operationalWorkDate);
  const submittedLocalDate = dateKey(version.submittedLocalDate);
  const completeOrderedItems =
    version.items.length > 0 &&
    version.items.length <= 50 &&
    version.items.every(
      (item, index) =>
        item.sequence === index + 1 &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 999_999,
    );
  if (
    !Number.isSafeInteger(version.versionNumber) ||
    version.versionNumber < 1 ||
    version.versionNumber > 2_147_483_647 ||
    !operationalWorkDate ||
    !submittedLocalDate ||
    !isCanonicalSupplyRequestLocalTime(version.submittedLocalTime) ||
    !completeOrderedItems
  ) {
    return false;
  }

  const fulfillmentOperationalWorkDate = dateKey(
    version.fulfillmentOperationalWorkDate,
  );
  const fulfilledLocalDate = dateKey(version.fulfilledLocalDate);
  const cancelledLocalDate = dateKey(version.cancelledLocalDate);
  const hasFulfillment =
    fulfillmentOperationalWorkDate !== null &&
    fulfilledLocalDate !== null &&
    version.fulfilledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.fulfilledLocalTime) &&
    fulfillmentOperationalWorkDate >= operationalWorkDate &&
    `${fulfilledLocalDate}T${version.fulfilledLocalTime}` >=
      `${submittedLocalDate}T${version.submittedLocalTime}`;
  const hasAnyFulfillment =
    version.fulfillmentOperationalWorkDate !== null ||
    version.fulfilledLocalDate !== null ||
    version.fulfilledLocalTime !== null ||
    version.fulfillmentNote !== null;
  const hasCancellation =
    cancelledLocalDate !== null &&
    version.cancelledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.cancelledLocalTime) &&
    `${cancelledLocalDate}T${version.cancelledLocalTime}` >=
      `${submittedLocalDate}T${version.submittedLocalTime}`;
  const hasAnyCancellation =
    version.cancelledLocalDate !== null ||
    version.cancelledLocalTime !== null ||
    version.cancellationReason !== null;
  const hasAnyCorrection =
    version.correctionReason !== null ||
    version.correctedByDisplayNameSnapshot !== null ||
    version.correctionLocalDate !== null ||
    version.correctionLocalTime !== null;
  const hasCompleteCorrection =
    version.correctionReason !== null &&
    version.correctedByDisplayNameSnapshot !== null &&
    version.correctionLocalDate !== null &&
    version.correctionLocalTime !== null;
  const correctionIsCoherent =
    (version.changeKind !== "CORRECTED" && !hasAnyCorrection) ||
    (version.changeKind === "CORRECTED" && hasCompleteCorrection);

  if (version.status === "REQUESTED") {
    return (
      (version.changeKind === "CREATED" ||
        version.changeKind === "CORRECTED") &&
      !hasAnyFulfillment &&
      !hasAnyCancellation &&
      correctionIsCoherent
    );
  }
  if (version.status === "FULFILLED") {
    return (
      (version.changeKind === "FULFILLED" ||
        version.changeKind === "CORRECTED") &&
      hasFulfillment &&
      !hasAnyCancellation &&
      correctionIsCoherent
    );
  }
  return (
    version.status === "CANCELLED" &&
    (version.changeKind === "CANCELLED" ||
      version.changeKind === "CORRECTED") &&
    hasCancellation &&
    !hasAnyFulfillment &&
    correctionIsCoherent
  );
}

function mapVersion(
  supplyRequestId: string,
  namReference: string,
  version: Prisma.SupplyRequestVersionGetPayload<{
    select: typeof versionSelect;
  }>,
): SupplyRequestDetailView | null {
  if (!lifecycleFieldsAreCoherent(version)) return null;
  return {
    supplyRequestId,
    namReference,
    versionId: version.id,
    versionNumber: version.versionNumber,
    changeKind: version.changeKind,
    status: version.status,
    operationalWorkDate: dateKey(version.operationalWorkDate) ?? "",
    submittedLocalDate: dateKey(version.submittedLocalDate) ?? "",
    submittedLocalTime: version.submittedLocalTime,
    equipmentId: version.equipmentId,
    equipmentAvailable: version.equipment !== null,
    equipmentLabel: supplyRequestEquipmentSnapshotLabel(
      version.equipmentDisplayNameSnapshot,
      version.equipmentNumberSnapshot,
    ),
    equipmentDisplayName: version.equipmentDisplayNameSnapshot,
    equipmentNumber: version.equipmentNumberSnapshot,
    equipmentCategory: version.equipmentCategorySnapshot,
    mineName: version.mineNameSnapshot,
    cityName: version.cityNameSnapshot,
    cityState: version.cityStateSnapshot,
    requesterDisplayName: version.requesterDisplayNameSnapshot,
    requesterEmployeeNumber: version.requesterEmployeeNumberSnapshot,
    supervisorName: version.supervisorNameSnapshot,
    supervisorEmail: version.supervisorEmailSnapshot,
    notes: version.notes,
    items: version.items.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      itemNumber: item.itemNumberSnapshot,
      description: item.descriptionSnapshot,
      quantity: item.quantity,
      unit: item.unitOfMeasureSnapshot,
    })),
    createdAtLabel: formatSupplyRequestRecordedAt(version.createdAt),
    fulfillmentOperationalWorkDate: dateKey(
      version.fulfillmentOperationalWorkDate,
    ),
    fulfilledLocalDate: dateKey(version.fulfilledLocalDate),
    fulfilledLocalTime: version.fulfilledLocalTime,
    fulfillmentNote: version.fulfillmentNote,
    cancellationLocalDate: dateKey(version.cancelledLocalDate),
    cancellationLocalTime: version.cancelledLocalTime,
    cancellationReason: version.cancellationReason,
    correctionReason: version.correctionReason,
  };
}

export async function searchActiveSupplyRequestEquipmentWithClient(
  client: PrismaClient,
  queryInput: unknown,
) {
  const query = parseSupplyRequestSearchQuery(queryInput);
  if (query === null) return [];
  const records = await client.equipment.findMany({
    where: {
      status: "ACTIVE",
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { equipmentNumber: { contains: query, mode: "insensitive" } },
              { mine: { name: { contains: query, mode: "insensitive" } } },
              {
                mine: {
                  city: { name: { contains: query, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      equipmentNumber: true,
      mine: { select: { name: true, city: { select: { name: true, state: true } } } },
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: supplyRequestOptionLimit,
  });
  return records.map((record) => ({
    id: record.id,
    label: supplyRequestEquipmentSnapshotLabel(
      record.displayName,
      record.equipmentNumber,
    ),
    displayName: record.displayName,
    equipmentNumber: record.equipmentNumber,
    mineName: record.mine.name,
    cityName: record.mine.city.name,
    cityState: record.mine.city.state,
  }));
}

export async function searchActiveSupplyRequestSupervisorsWithClient(
  client: PrismaClient,
  queryInput: unknown,
) {
  const query = parseSupplyRequestSearchQuery(queryInput);
  if (query === null) return [];
  return client.supplyRequestSupervisor.findMany({
    where: {
      active: true,
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { normalizedEmail: { contains: query.toLowerCase() } },
            ],
          }
        : {}),
    },
    select: { id: true, fullName: true, email: true },
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    take: supplyRequestOptionLimit,
  });
}

export async function searchActiveSupplyRequestItemsWithClient(
  client: PrismaClient,
  queryInput: unknown,
) {
  const query = parseSupplyRequestSearchQuery(queryInput);
  if (query === null) return [];
  const records = await client.supplyItem.findMany({
    where: {
      active: true,
      ...(query
        ? {
            OR: [
              {
                normalizedItemNumber: {
                  contains: normalizeSupplyItemNumberKey(query),
                },
              },
              { itemNumber: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      itemNumber: true,
      description: true,
      unitOfMeasure: true,
    },
    orderBy: [{ itemNumber: "asc" }, { id: "asc" }],
    take: supplyRequestOptionLimit,
  });
  return records.map((record) => ({
    id: record.id,
    itemNumber: record.itemNumber,
    description: record.description,
    unit: record.unitOfMeasure,
  }));
}

export async function getSupplyRequestCreatePageDataWithClient(
  client: PrismaClient,
): Promise<SupplyRequestCreatePageData> {
  const [equipment, supervisors, items, equipmentCount, supervisorCount, itemCount] =
    await Promise.all([
      searchActiveSupplyRequestEquipmentWithClient(client, ""),
      searchActiveSupplyRequestSupervisorsWithClient(client, ""),
      searchActiveSupplyRequestItemsWithClient(client, ""),
      client.equipment.count({ where: { status: "ACTIVE" } }),
      client.supplyRequestSupervisor.count({ where: { active: true } }),
      client.supplyItem.count({ where: { active: true } }),
    ]);
  return {
    equipment,
    supervisors,
    items,
    hasActiveEquipment: equipmentCount > 0,
    hasActiveSupervisors: supervisorCount > 0,
    hasActiveItems: itemCount > 0,
    loadError: null,
  };
}

export async function getCurrentSupplyRequestDetailWithClient(
  client: PrismaClient,
  idInput: unknown,
) {
  const id = parseSupplyRequestRouteId(idInput);
  if (!id) return null;
  const root = await client.supplyRequest.findUnique({
    where: { id },
    select: {
      id: true,
      namReference: true,
      currentVersionId: true,
      currentVersion: { select: versionSelect },
    },
  });
  if (
    !root?.currentVersionId ||
    !root.currentVersion ||
    root.currentVersion.id !== root.currentVersionId ||
    root.currentVersion.supplyRequestId !== root.id
  ) {
    return null;
  }
  return mapVersion(root.id, root.namReference, root.currentVersion);
}

export async function getSupplyRequestLifecycleActionContextWithClient(
  client: PrismaClient,
  idInput: unknown,
) {
  const detail = await getCurrentSupplyRequestDetailWithClient(client, idInput);
  if (!detail) return null;
  return {
    supplyRequestId: detail.supplyRequestId,
    namReference: detail.namReference,
    versionNumber: detail.versionNumber,
    status: detail.status,
    operationalWorkDate: detail.operationalWorkDate,
    submittedLocalDate: detail.submittedLocalDate,
    submittedLocalTime: detail.submittedLocalTime,
    equipmentLabel: detail.equipmentLabel,
    itemCount: detail.items.length,
  } as const;
}

export async function getOriginalSupplyRequestDetailWithClient(
  client: PrismaClient,
  idInput: unknown,
  versionInput: unknown,
) {
  const id = parseSupplyRequestRouteId(idInput);
  const versionNumber = parseSupplyRequestOriginalVersion(versionInput);
  if (!id || versionNumber !== 1) return null;
  const version = await client.supplyRequestVersion.findUnique({
    where: {
      supplyRequestId_versionNumber: {
        supplyRequestId: id,
        versionNumber,
      },
    },
    select: {
      ...versionSelect,
      supplyRequest: { select: { id: true, namReference: true } },
    },
  });
  if (!version || version.supplyRequest.id !== id) return null;
  return mapVersion(id, version.supplyRequest.namReference, version);
}
