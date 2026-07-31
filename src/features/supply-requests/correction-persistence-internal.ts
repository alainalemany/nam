import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient, type SupplyRequestStatus } from "@prisma/client";

import {
  SupplyRequestCorrectionError,
  unexpectedSupplyRequestCorrectionError,
} from "./correction-errors";
import { runSupplyRequestCorrectionWithRetry } from "./correction-retry";
import {
  parseCorrectSupplyRequestInput,
  type CorrectSupplyRequestInput,
  type ValidatedCorrectSupplyRequestInput,
} from "./correction-validation";
import { supplyRequestRequester } from "./server-config";
import {
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
  supplyRequestDateToUtc,
} from "./validation";
import { supplyRequestNewYorkWallClock } from "./wall-clock";

export type CorrectSupplyRequestResult = Readonly<{
  supplyRequestId: string;
  namReference: string;
  currentVersionId: string;
  newVersionNumber: number;
  status: SupplyRequestStatus;
}>;

export type SupplyRequestCorrectionDependencies = Readonly<{
  client: PrismaClient;
  now?: () => Date;
  generateId?: () => string;
}>;

const currentVersionSelect = {
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
  supervisorId: true,
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
  items: {
    select: {
      id: true,
      supplyItemId: true,
      sequence: true,
      quantity: true,
      itemNumberSnapshot: true,
      normalizedItemNumberSnapshot: true,
      descriptionSnapshot: true,
      unitOfMeasureSnapshot: true,
    },
    orderBy: [{ sequence: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.SupplyRequestVersionSelect;

type CurrentVersion = Prisma.SupplyRequestVersionGetPayload<{
  select: typeof currentVersionSelect;
}>;

function invalidCurrentState(): never {
  throw new SupplyRequestCorrectionError(
    "CURRENT_VERSION_INVALID",
    "The Supply Request current-version state is invalid and could not be corrected in NAM.",
  );
}

function dateKey(value: unknown) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const key = value.toISOString().slice(0, 10);
  return isCanonicalSupplyRequestDate(key) ? key : null;
}

function usableSnapshot(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function usableNarrative(value: unknown, maximum: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maximum
  );
}

function assertCurrentVersionIntegrity(current: CurrentVersion) {
  const operationalWorkDate = dateKey(current.operationalWorkDate);
  const submittedLocalDate = dateKey(current.submittedLocalDate);
  if (
    !Number.isSafeInteger(current.versionNumber) ||
    current.versionNumber < 1 ||
    current.versionNumber > 2_147_483_647 ||
    !operationalWorkDate ||
    !submittedLocalDate ||
    !isCanonicalSupplyRequestLocalTime(current.submittedLocalTime) ||
    !usableSnapshot(current.equipmentDisplayNameSnapshot) ||
    !usableSnapshot(current.mineNameSnapshot) ||
    !usableSnapshot(current.cityNameSnapshot) ||
    !usableSnapshot(current.requesterDisplayNameSnapshot) ||
    !usableSnapshot(current.requesterEmployeeNumberSnapshot) ||
    !usableSnapshot(current.supervisorId) ||
    !usableSnapshot(current.supervisorNameSnapshot) ||
    !usableSnapshot(current.supervisorEmailSnapshot) ||
    (current.notes !== null &&
      (typeof current.notes !== "string" ||
        current.notes.trim().length === 0 ||
        current.notes.trim().length > 2_000)) ||
    current.items.length < 1 ||
    current.items.length > 50
  ) {
    invalidCurrentState();
  }

  const itemIds = new Set<string>();
  current.items.forEach((item, index) => {
    if (
      item.sequence !== index + 1 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999_999 ||
      itemIds.has(item.supplyItemId) ||
      !usableSnapshot(item.supplyItemId) ||
      !usableSnapshot(item.itemNumberSnapshot) ||
      !usableSnapshot(item.normalizedItemNumberSnapshot) ||
      !usableSnapshot(item.descriptionSnapshot) ||
      !usableSnapshot(item.unitOfMeasureSnapshot)
    ) {
      invalidCurrentState();
    }
    itemIds.add(item.supplyItemId);
  });

  const fulfillmentDate = dateKey(current.fulfillmentOperationalWorkDate);
  const fulfilledDate = dateKey(current.fulfilledLocalDate);
  const cancellationDate = dateKey(current.cancelledLocalDate);
  const hasAnyFulfillment =
    current.fulfillmentOperationalWorkDate !== null ||
    current.fulfilledLocalDate !== null ||
    current.fulfilledLocalTime !== null ||
    current.fulfillmentNote !== null;
  const hasCompleteFulfillment =
    fulfillmentDate !== null &&
    fulfilledDate !== null &&
    current.fulfilledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(current.fulfilledLocalTime) &&
    (current.fulfillmentNote === null ||
      usableNarrative(current.fulfillmentNote, 1_000)) &&
    fulfillmentDate >= operationalWorkDate &&
    `${fulfilledDate}T${current.fulfilledLocalTime}` >=
      `${submittedLocalDate}T${current.submittedLocalTime}`;
  const hasAnyCancellation =
    current.cancelledLocalDate !== null ||
    current.cancelledLocalTime !== null ||
    current.cancellationReason !== null;
  const hasCompleteCancellation =
    cancellationDate !== null &&
    current.cancelledLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(current.cancelledLocalTime) &&
    (current.cancellationReason === null ||
      usableNarrative(current.cancellationReason, 1_000)) &&
    `${cancellationDate}T${current.cancelledLocalTime}` >=
      `${submittedLocalDate}T${current.submittedLocalTime}`;
  const hasAnyCorrection =
    current.correctionReason !== null ||
    current.correctedByDisplayNameSnapshot !== null ||
    current.correctionLocalDate !== null ||
    current.correctionLocalTime !== null;
  const hasCompleteCorrection =
    usableNarrative(current.correctionReason, 1_000) &&
    usableSnapshot(current.correctedByDisplayNameSnapshot) &&
    dateKey(current.correctionLocalDate) !== null &&
    current.correctionLocalTime !== null &&
    isCanonicalSupplyRequestLocalTime(current.correctionLocalTime);
  const correctionCoherent =
    (current.changeKind === "CORRECTED" && hasCompleteCorrection) ||
    (current.changeKind !== "CORRECTED" && !hasAnyCorrection);
  const changeKindCoherent =
    (current.status === "REQUESTED" &&
      (current.changeKind === "CREATED" ||
        current.changeKind === "CORRECTED")) ||
    (current.status === "FULFILLED" &&
      (current.changeKind === "FULFILLED" ||
        current.changeKind === "CORRECTED")) ||
    (current.status === "CANCELLED" &&
      (current.changeKind === "CANCELLED" ||
        current.changeKind === "CORRECTED"));
  const statusCoherent =
    (current.status === "REQUESTED" &&
      !hasAnyFulfillment &&
      !hasAnyCancellation) ||
    (current.status === "FULFILLED" &&
      hasCompleteFulfillment &&
      !hasAnyCancellation) ||
    (current.status === "CANCELLED" &&
      hasCompleteCancellation &&
      !hasAnyFulfillment);
  if (!correctionCoherent || !changeKindCoherent || !statusCoherent) {
    invalidCurrentState();
  }
}

function nextId(generateId: () => string) {
  const value = generateId();
  if (typeof value !== "string" || value.trim().length === 0) {
    throw unexpectedSupplyRequestCorrectionError();
  }
  return value;
}

async function lockAndLoad(
  transaction: Prisma.TransactionClient,
  supplyRequestId: string,
) {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "SupplyRequest"
      WHERE "id" = ${supplyRequestId}
      FOR UPDATE
    `,
  );
  if (locked.length === 0) {
    throw new SupplyRequestCorrectionError(
      "REQUEST_NOT_FOUND",
      "The Supply Request could not be found.",
    );
  }
  if (
    locked.length !== 1 ||
    typeof locked[0]?.id !== "string" ||
    locked[0].id !== supplyRequestId
  ) {
    invalidCurrentState();
  }
  const root = await transaction.supplyRequest.findUnique({
    where: { id: supplyRequestId },
    select: {
      id: true,
      namReference: true,
      currentVersionId: true,
      currentVersion: { select: currentVersionSelect },
    },
  });
  if (
    !root ||
    !root.currentVersionId ||
    !root.currentVersion ||
    root.currentVersion.id !== root.currentVersionId ||
    root.currentVersion.supplyRequestId !== root.id
  ) {
    invalidCurrentState();
  }
  assertCurrentVersionIntegrity(root.currentVersion);
  return { root, current: root.currentVersion };
}

async function equipmentSnapshots(
  transaction: Prisma.TransactionClient,
  current: CurrentVersion,
  equipmentId: string,
) {
  if (current.equipmentId && current.equipmentId === equipmentId) {
    return {
      equipmentId: current.equipmentId,
      equipmentDisplayNameSnapshot: current.equipmentDisplayNameSnapshot,
      equipmentNumberSnapshot: current.equipmentNumberSnapshot,
      equipmentCategorySnapshot: current.equipmentCategorySnapshot,
      mineNameSnapshot: current.mineNameSnapshot,
      cityNameSnapshot: current.cityNameSnapshot,
      cityStateSnapshot: current.cityStateSnapshot,
    };
  }
  const equipment = await transaction.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      status: true,
      displayName: true,
      equipmentNumber: true,
      category: true,
      mine: {
        select: {
          name: true,
          city: { select: { name: true, state: true } },
        },
      },
    },
  });
  if (!equipment) {
    throw new SupplyRequestCorrectionError(
      current.equipmentId ? "EQUIPMENT_NOT_FOUND" : "EQUIPMENT_REPLACEMENT_REQUIRED",
      current.equipmentId
        ? "The selected replacement Equipment could not be found."
        : "Select an active replacement Equipment because the prior live Equipment record is unavailable.",
      "equipmentId",
    );
  }
  if (equipment.status !== "ACTIVE") {
    throw new SupplyRequestCorrectionError(
      "EQUIPMENT_INACTIVE",
      "The selected replacement Equipment is inactive. Select an active Equipment.",
      "equipmentId",
    );
  }
  return {
    equipmentId: equipment.id,
    equipmentDisplayNameSnapshot: equipment.displayName,
    equipmentNumberSnapshot: equipment.equipmentNumber,
    equipmentCategorySnapshot: equipment.category,
    mineNameSnapshot: equipment.mine.name,
    cityNameSnapshot: equipment.mine.city.name,
    cityStateSnapshot: equipment.mine.city.state,
  };
}

async function supervisorSnapshots(
  transaction: Prisma.TransactionClient,
  current: CurrentVersion,
  supervisorId: string,
) {
  if (current.supervisorId === supervisorId) {
    return {
      supervisorId: current.supervisorId,
      supervisorNameSnapshot: current.supervisorNameSnapshot,
      supervisorEmailSnapshot: current.supervisorEmailSnapshot,
    };
  }
  const supervisor = await transaction.supplyRequestSupervisor.findUnique({
    where: { id: supervisorId },
    select: { id: true, active: true, fullName: true, email: true },
  });
  if (!supervisor) {
    throw new SupplyRequestCorrectionError(
      "SUPERVISOR_NOT_FOUND",
      "The selected replacement supervisor could not be found.",
      "supervisorId",
    );
  }
  if (!supervisor.active) {
    throw new SupplyRequestCorrectionError(
      "SUPERVISOR_INACTIVE",
      "The selected replacement supervisor is inactive. Select an active supervisor.",
      "supervisorId",
    );
  }
  return {
    supervisorId: supervisor.id,
    supervisorNameSnapshot: supervisor.fullName,
    supervisorEmailSnapshot: supervisor.email,
  };
}

async function correctedItems(
  transaction: Prisma.TransactionClient,
  current: CurrentVersion,
  input: ValidatedCorrectSupplyRequestInput,
  versionId: string,
  generateId: () => string,
) {
  const existing = new Map(
    current.items.map((item) => [item.supplyItemId, item] as const),
  );
  const newIds = input.items
    .map((item) => item.supplyItemId)
    .filter((id) => !existing.has(id));
  const catalog = await transaction.supplyItem.findMany({
    where: { id: { in: newIds } },
    select: {
      id: true,
      active: true,
      itemNumber: true,
      normalizedItemNumber: true,
      description: true,
      unitOfMeasure: true,
    },
  });
  const catalogById = new Map(catalog.map((item) => [item.id, item] as const));
  return input.items.map((inputItem, index) => {
    const retained = existing.get(inputItem.supplyItemId);
    const added = catalogById.get(inputItem.supplyItemId);
    if (!retained && !added) {
      throw new SupplyRequestCorrectionError(
        "SUPPLY_ITEM_NOT_FOUND",
        "A selected Supply Item addition could not be found.",
        "items",
      );
    }
    if (added && !added.active) {
      throw new SupplyRequestCorrectionError(
        "SUPPLY_ITEM_INACTIVE",
        "A selected Supply Item addition is inactive. Select an active item.",
        "items",
      );
    }
    return {
      id: nextId(generateId),
      versionId,
      supplyItemId: inputItem.supplyItemId,
      sequence: index + 1,
      quantity: inputItem.quantity,
      itemNumberSnapshot:
        retained?.itemNumberSnapshot ?? added?.itemNumber ?? "",
      normalizedItemNumberSnapshot:
        retained?.normalizedItemNumberSnapshot ??
        added?.normalizedItemNumber ??
        "",
      descriptionSnapshot:
        retained?.descriptionSnapshot ?? added?.description ?? "",
      unitOfMeasureSnapshot:
        retained?.unitOfMeasureSnapshot ?? added?.unitOfMeasure ?? "",
    };
  });
}

function lifecycleData(input: ValidatedCorrectSupplyRequestInput) {
  if (input.resultingStatus === "FULFILLED") {
    return {
      fulfillmentOperationalWorkDate: supplyRequestDateToUtc(
        input.fulfillmentOperationalWorkDate!,
      ),
      fulfilledLocalDate: supplyRequestDateToUtc(input.fulfilledLocalDate!),
      fulfilledLocalTime: input.fulfilledLocalTime!,
      fulfillmentNote: input.fulfillmentNote ?? null,
      cancelledLocalDate: null,
      cancelledLocalTime: null,
      cancellationReason: null,
    };
  }
  if (input.resultingStatus === "CANCELLED") {
    return {
      fulfillmentOperationalWorkDate: null,
      fulfilledLocalDate: null,
      fulfilledLocalTime: null,
      fulfillmentNote: null,
      cancelledLocalDate: supplyRequestDateToUtc(input.cancelledLocalDate!),
      cancelledLocalTime: input.cancelledLocalTime!,
      cancellationReason: input.cancellationReason ?? null,
    };
  }
  return {
    fulfillmentOperationalWorkDate: null,
    fulfilledLocalDate: null,
    fulfilledLocalTime: null,
    fulfillmentNote: null,
    cancelledLocalDate: null,
    cancelledLocalTime: null,
    cancellationReason: null,
  };
}

async function correctionAttempt(
  client: PrismaClient,
  input: ValidatedCorrectSupplyRequestInput,
  correctionDate: string,
  correctionTime: string,
  generateId: () => string,
): Promise<CorrectSupplyRequestResult> {
  return client.$transaction(
    async (transaction) => {
      const { root, current } = await lockAndLoad(
        transaction,
        input.supplyRequestId,
      );
      if (input.expectedCurrentVersionNumber !== current.versionNumber) {
        throw new SupplyRequestCorrectionError(
          "STALE_VERSION",
          "This Supply Request changed after the correction form was loaded. Reload the current request before trying again.",
          "expectedCurrentVersionNumber",
        );
      }

      const equipment = await equipmentSnapshots(
        transaction,
        current,
        input.equipmentId,
      );
      const supervisor = await supervisorSnapshots(
        transaction,
        current,
        input.supervisorId,
      );
      const nextVersionNumber = current.versionNumber + 1;
      if (
        !Number.isSafeInteger(nextVersionNumber) ||
        nextVersionNumber > 2_147_483_647
      ) {
        invalidCurrentState();
      }
      const versionId = nextId(generateId);
      const items = await correctedItems(
        transaction,
        current,
        input,
        versionId,
        generateId,
      );
      const version = await transaction.supplyRequestVersion.create({
        data: {
          id: versionId,
          supplyRequestId: root.id,
          versionNumber: nextVersionNumber,
          changeKind: "CORRECTED",
          status: input.resultingStatus,
          operationalWorkDate: supplyRequestDateToUtc(input.operationalWorkDate),
          submittedLocalDate: supplyRequestDateToUtc(input.submittedLocalDate),
          submittedLocalTime: input.submittedLocalTime,
          ...equipment,
          requesterDisplayNameSnapshot:
            current.requesterDisplayNameSnapshot,
          requesterEmployeeNumberSnapshot:
            current.requesterEmployeeNumberSnapshot,
          ...supervisor,
          notes: input.notes ?? null,
          ...lifecycleData(input),
          correctionReason: input.correctionReason,
          correctedByDisplayNameSnapshot: supplyRequestRequester.displayName,
          correctionLocalDate: supplyRequestDateToUtc(correctionDate),
          correctionLocalTime: correctionTime,
          items: {
            create: items.map(({ versionId: _versionId, ...item }) => item),
          },
        },
        select: { id: true, versionNumber: true, status: true },
      });
      const updated = await transaction.supplyRequest.update({
        where: { id: root.id },
        data: {
          currentVersion: {
            connect: {
              id_supplyRequestId: {
                id: version.id,
                supplyRequestId: root.id,
              },
            },
          },
        },
        select: { id: true, namReference: true, currentVersionId: true },
      });
      if (updated.currentVersionId !== version.id) invalidCurrentState();
      return {
        supplyRequestId: updated.id,
        namReference: updated.namReference,
        currentVersionId: version.id,
        newVersionNumber: version.versionNumber,
        status: version.status,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

export async function correctSupplyRequestWithDependencies(
  input: CorrectSupplyRequestInput,
  dependencies: SupplyRequestCorrectionDependencies,
): Promise<CorrectSupplyRequestResult> {
  try {
    const parsed = parseCorrectSupplyRequestInput(input);
    const clock = supplyRequestNewYorkWallClock(
      (dependencies.now ?? (() => new Date()))(),
    );
    const generateId = dependencies.generateId ?? randomUUID;
    return await runSupplyRequestCorrectionWithRetry(() =>
      correctionAttempt(
        dependencies.client,
        parsed,
        clock.date,
        clock.time,
        generateId,
      ),
    );
  } catch (error) {
    if (error instanceof SupplyRequestCorrectionError) throw error;
    throw unexpectedSupplyRequestCorrectionError();
  }
}
