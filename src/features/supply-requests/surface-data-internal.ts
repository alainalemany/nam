import type { Prisma, PrismaClient } from "@prisma/client";

import { normalizeSupplyItemNumberKey } from "./normalization";
import { SupplyRequestDailyLogLinkQueryError } from "./daily-log-link-errors";
import type { SupplyRequestDailyLogLinkSummary } from "./daily-log-link-types";
import { validateSupplyRequestDailyLogCompatibility } from "./daily-log-link-validation";
import {
  formatSupplyRequestRecordedAt,
  supplyRequestEquipmentSnapshotLabel,
} from "./surface-display";
import type {
  SupplyRequestCreatePageData,
  SupplyRequestDetailView,
  SupplyRequestImmutableVersionView,
  SupplyRequestVersionSummary,
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
type SupplyRequestSurfaceClient = PrismaClient | Prisma.TransactionClient;

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
  supervisorId: true,
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
      supplyItemId: true,
      sequence: true,
      itemNumberSnapshot: true,
      normalizedItemNumberSnapshot: true,
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

function usableText(value: unknown, maximum?: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (maximum === undefined || value.trim().length <= maximum)
  );
}

function lifecycleFieldsAreCoherent(
  version: Prisma.SupplyRequestVersionGetPayload<{
    select: typeof versionSelect;
  }>,
) {
  const operationalWorkDate = dateKey(version.operationalWorkDate);
  const submittedLocalDate = dateKey(version.submittedLocalDate);
  const itemIds = new Set<string>();
  const completeOrderedItems =
    version.items.length > 0 &&
    version.items.length <= 50 &&
    version.items.every(
      (item, index) => {
        const valid =
          item.sequence === index + 1 &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 999_999 &&
          (item.supplyItemId === undefined ||
            (usableText(item.supplyItemId) &&
              !itemIds.has(item.supplyItemId))) &&
          usableText(item.itemNumberSnapshot) &&
          (item.normalizedItemNumberSnapshot === undefined ||
            usableText(item.normalizedItemNumberSnapshot)) &&
          usableText(item.descriptionSnapshot) &&
          usableText(item.unitOfMeasureSnapshot);
        itemIds.add(item.supplyItemId);
        return valid;
      },
    );
  if (
    !Number.isSafeInteger(version.versionNumber) ||
    version.versionNumber < 1 ||
    version.versionNumber > 2_147_483_647 ||
    !operationalWorkDate ||
    !submittedLocalDate ||
    !isCanonicalSupplyRequestLocalTime(version.submittedLocalTime) ||
    !usableText(version.equipmentDisplayNameSnapshot) ||
    !usableText(version.mineNameSnapshot) ||
    !usableText(version.cityNameSnapshot) ||
    !usableText(version.requesterDisplayNameSnapshot) ||
    !usableText(version.requesterEmployeeNumberSnapshot) ||
    (version.supervisorId !== undefined &&
      !usableText(version.supervisorId)) ||
    !usableText(version.supervisorNameSnapshot) ||
    !usableText(version.supervisorEmailSnapshot) ||
    (version.notes !== null && !usableText(version.notes, 2_000)) ||
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
    (version.fulfillmentNote === null ||
      usableText(version.fulfillmentNote, 1_000)) &&
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
    (version.cancellationReason === null ||
      usableText(version.cancellationReason, 1_000)) &&
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
    usableText(version.correctionReason, 1_000) &&
    usableText(version.correctedByDisplayNameSnapshot) &&
    dateKey(version.correctionLocalDate) !== null &&
    version.correctionLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.correctionLocalTime);
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
    supervisorId: version.supervisorId,
    notes: version.notes,
    items: version.items.map((item) => ({
      id: item.id,
      supplyItemId: item.supplyItemId,
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
    correctedByDisplayName: version.correctedByDisplayNameSnapshot,
    correctionLocalDate: dateKey(version.correctionLocalDate),
    correctionLocalTime: version.correctionLocalTime,
  };
}

export async function searchActiveSupplyRequestEquipmentWithClient(
  client: SupplyRequestSurfaceClient,
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
  client: SupplyRequestSurfaceClient,
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
  client: SupplyRequestSurfaceClient,
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
  client: SupplyRequestSurfaceClient,
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
  client: SupplyRequestSurfaceClient,
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
  client: SupplyRequestSurfaceClient,
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

export async function getImmutableSupplyRequestVersionWithClient(
  client: SupplyRequestSurfaceClient,
  idInput: unknown,
  versionInput: unknown,
): Promise<SupplyRequestImmutableVersionView | null> {
  const id = parseSupplyRequestRouteId(idInput);
  const versionNumber = parseSupplyRequestOriginalVersion(versionInput);
  if (!id || !versionNumber) return null;
  const version = await client.supplyRequestVersion.findUnique({
    where: {
      supplyRequestId_versionNumber: {
        supplyRequestId: id,
        versionNumber,
      },
    },
    select: {
      ...versionSelect,
      supplyRequest: {
        select: {
          id: true,
          namReference: true,
          currentVersionId: true,
          currentVersion: {
            select: { id: true, supplyRequestId: true, versionNumber: true },
          },
        },
      },
    },
  });
  if (
    !version ||
    version.supplyRequest.id !== id ||
    !version.supplyRequest.currentVersionId ||
    !version.supplyRequest.currentVersion ||
    version.supplyRequest.currentVersion.id !==
      version.supplyRequest.currentVersionId ||
    version.supplyRequest.currentVersion.supplyRequestId !== id
  ) {
    return null;
  }
  const detail = mapVersion(id, version.supplyRequest.namReference, version);
  if (!detail) return null;
  return {
    detail,
    role:
      version.versionNumber === 1
        ? "original"
        : version.id === version.supplyRequest.currentVersionId
          ? "current"
          : "superseded",
    currentVersionNumber:
      version.supplyRequest.currentVersion.versionNumber,
  };
}

export async function getOriginalSupplyRequestDetailWithClient(
  client: SupplyRequestSurfaceClient,
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

function summaryChangeTime(
  version: {
    changeKind: "CREATED" | "FULFILLED" | "CANCELLED" | "CORRECTED";
    submittedLocalDate: Date;
    submittedLocalTime: string;
    fulfilledLocalDate: Date | null;
    fulfilledLocalTime: string | null;
    cancelledLocalDate: Date | null;
    cancelledLocalTime: string | null;
    correctionLocalDate: Date | null;
    correctionLocalTime: string | null;
  },
) {
  if (version.changeKind === "FULFILLED") {
    return {
      date: dateKey(version.fulfilledLocalDate),
      time: version.fulfilledLocalTime,
    };
  }
  if (version.changeKind === "CANCELLED") {
    return {
      date: dateKey(version.cancelledLocalDate),
      time: version.cancelledLocalTime,
    };
  }
  if (version.changeKind === "CORRECTED") {
    return {
      date: dateKey(version.correctionLocalDate),
      time: version.correctionLocalTime,
    };
  }
  return {
    date: dateKey(version.submittedLocalDate),
    time: version.submittedLocalTime,
  };
}

function historySummaryIsCoherent(
  version: {
    versionNumber: number;
    changeKind: "CREATED" | "FULFILLED" | "CANCELLED" | "CORRECTED";
    status: "REQUESTED" | "FULFILLED" | "CANCELLED";
    fulfilledLocalDate: Date | null;
    fulfilledLocalTime: string | null;
    cancelledLocalDate: Date | null;
    cancelledLocalTime: string | null;
    correctionLocalDate: Date | null;
    correctionLocalTime: string | null;
    correctionReason: string | null;
  },
) {
  if (
    !Number.isSafeInteger(version.versionNumber) ||
    version.versionNumber < 1 ||
    version.versionNumber > 2_147_483_647
  ) {
    return false;
  }
  const hasCorrectionSummary =
    version.correctionLocalDate !== null ||
    version.correctionLocalTime !== null ||
    version.correctionReason !== null;
  if (version.changeKind === "CORRECTED") {
    return (
      usableText(version.correctionReason, 1_000) &&
      dateKey(version.correctionLocalDate) !== null &&
      version.correctionLocalTime !== null &&
      isCanonicalSupplyRequestLocalTime(version.correctionLocalTime)
    );
  }
  if (hasCorrectionSummary) return false;
  if (version.changeKind === "CREATED") {
    return version.status === "REQUESTED";
  }
  if (version.changeKind === "FULFILLED") {
    return (
      version.status === "FULFILLED" &&
      dateKey(version.fulfilledLocalDate) !== null &&
      version.fulfilledLocalTime !== null &&
      isCanonicalSupplyRequestLocalTime(version.fulfilledLocalTime)
    );
  }
  return (
    version.changeKind === "CANCELLED" &&
    version.status === "CANCELLED" &&
    dateKey(version.cancelledLocalDate) !== null &&
    version.cancelledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(version.cancelledLocalTime)
  );
}

export async function getSupplyRequestCorrectionHistoryWithClient(
  client: SupplyRequestSurfaceClient,
  idInput: unknown,
): Promise<readonly SupplyRequestVersionSummary[] | null> {
  const id = parseSupplyRequestRouteId(idInput);
  if (!id) return null;
  const root = await client.supplyRequest.findUnique({
    where: { id },
    select: {
      id: true,
      currentVersionId: true,
      currentVersion: { select: { id: true, supplyRequestId: true } },
      versions: {
        where: { NOT: { currentForRequest: { is: { id } } } },
        select: {
          versionNumber: true,
          changeKind: true,
          status: true,
          submittedLocalDate: true,
          submittedLocalTime: true,
          fulfilledLocalDate: true,
          fulfilledLocalTime: true,
          cancelledLocalDate: true,
          cancelledLocalTime: true,
          correctionLocalDate: true,
          correctionLocalTime: true,
          correctionReason: true,
        },
        orderBy: { versionNumber: "desc" },
      },
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
  const summaries: SupplyRequestVersionSummary[] = [];
  for (const version of root.versions) {
    const change = summaryChangeTime(version);
    if (
      !historySummaryIsCoherent(version) ||
      !change.date ||
      !change.time ||
      !isCanonicalSupplyRequestLocalTime(change.time)
    ) {
      return null;
    }
    summaries.push({
      versionNumber: version.versionNumber,
      changeKind: version.changeKind,
      status: version.status,
      changeLocalDate: change.date,
      changeLocalTime: change.time,
      correctionReason: version.correctionReason,
    });
  }
  return summaries;
}

export async function getSupplyRequestCurrentPageDataWithClient(
  client: PrismaClient,
  idInput: unknown,
) {
  return client.$transaction(
    async (transaction) => {
      const detail = await getCurrentSupplyRequestDetailWithClient(
        transaction,
        idInput,
      );
      if (!detail) return null;
      const history = await getSupplyRequestCorrectionHistoryWithClient(
        transaction,
        idInput,
      );
      if (!history) return null;
      const links = await transaction.supplyRequestDailyLogLink.findMany({
        where: { supplyRequestId: detail.supplyRequestId },
        select: {
          role: true,
          dailyLogActivity: {
            select: {
              id: true,
              activityType: true,
              title: true,
              activityDate: true,
              sequence: true,
              startTime: true,
              endTime: true,
              equipmentId: true,
              dailyLog: { select: { id: true, logDate: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }],
      });
      const summaries: Partial<Record<"SUBMISSION" | "FULFILLMENT", SupplyRequestDailyLogLinkSummary>> = {};
      for (const link of links) {
        const issue = validateSupplyRequestDailyLogCompatibility(
          link.role,
          {
            namReference: detail.namReference,
            status: detail.status,
            operationalWorkDate: detail.operationalWorkDate,
            fulfillmentOperationalWorkDate: detail.fulfillmentOperationalWorkDate,
            equipmentId: detail.equipmentId,
            equipmentDisplayNameSnapshot: detail.equipmentDisplayName,
            equipmentNumberSnapshot: detail.equipmentNumber,
          },
          {
            activityType: link.dailyLogActivity.activityType,
            title: link.dailyLogActivity.title,
            activityDate: dateKey(link.dailyLogActivity.activityDate) ?? "",
            dailyLogDate: dateKey(link.dailyLogActivity.dailyLog.logDate) ?? "",
            equipmentId: link.dailyLogActivity.equipmentId,
          },
        );
        if (issue || summaries[link.role]) {
          throw new SupplyRequestDailyLogLinkQueryError(
            "LINK_INTEGRITY_INVALID",
            "Daily Log link information is incompatible with the current Supply Request. Remove or repair the affected link first.",
          );
        }
        summaries[link.role] = {
          role: link.role,
          activityId: link.dailyLogActivity.id,
          activityTitle: link.dailyLogActivity.title,
          activitySequence: link.dailyLogActivity.sequence,
          activityStartTime: link.dailyLogActivity.startTime,
          activityEndTime: link.dailyLogActivity.endTime,
          dailyLogId: link.dailyLogActivity.dailyLog.id,
          dailyLogDate: dateKey(link.dailyLogActivity.dailyLog.logDate) ?? "",
          dailyLogHref: `/daily-logs/${encodeURIComponent(link.dailyLogActivity.dailyLog.id)}`,
        };
      }
      return {
        detail,
        history,
        dailyLogLinks: {
          submission: summaries.SUBMISSION ?? null,
          fulfillment: summaries.FULFILLMENT ?? null,
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function getSupplyRequestCorrectionContextWithClient(
  client: SupplyRequestSurfaceClient,
  idInput: unknown,
) {
  const detail = await getCurrentSupplyRequestDetailWithClient(client, idInput);
  if (!detail) return null;
  const [activeEquipment, activeSupervisors, activeItems] = await Promise.all([
    searchActiveSupplyRequestEquipmentWithClient(client, ""),
    searchActiveSupplyRequestSupervisorsWithClient(client, ""),
    searchActiveSupplyRequestItemsWithClient(client, ""),
  ]);
  const equipment =
    detail.equipmentId &&
    !activeEquipment.some((option) => option.id === detail.equipmentId)
      ? [
          {
            id: detail.equipmentId,
            label: detail.equipmentLabel,
            displayName: detail.equipmentDisplayName,
            equipmentNumber: detail.equipmentNumber,
            mineName: detail.mineName,
            cityName: detail.cityName,
            cityState: detail.cityState,
          },
          ...activeEquipment,
        ]
      : activeEquipment;
  const supervisors = activeSupervisors.some(
    (option) => option.id === detail.supervisorId,
  )
    ? activeSupervisors
    : [
        {
          id: detail.supervisorId,
          fullName: detail.supervisorName,
          email: detail.supervisorEmail,
        },
        ...activeSupervisors,
      ];
  const existingItemOptions = detail.items.map((item) => ({
    id: item.supplyItemId,
    itemNumber: item.itemNumber,
    description: item.description,
    unit: item.unit,
  }));
  const existingIds = new Set(existingItemOptions.map((item) => item.id));
  return {
    detail,
    equipment,
    supervisors,
    items: [
      ...existingItemOptions,
      ...activeItems.filter((item) => !existingIds.has(item.id)),
    ],
    requiresEquipmentReplacement: detail.equipmentId === null,
  } as const;
}
