import { randomUUID } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  type SupplyRequestStatus,
} from "@prisma/client";

import {
  SupplyRequestLifecycleError,
  unexpectedSupplyRequestLifecycleError,
} from "./lifecycle-errors";
import { runSupplyRequestLifecycleWithRetry } from "./lifecycle-retry";
import {
  isLifecycleWallClockBeforeSubmission,
  parseCancelSupplyRequestInput,
  parseFulfillSupplyRequestInput,
  type CancelSupplyRequestInput,
  type FulfillSupplyRequestInput,
  type ValidatedCancelSupplyRequestInput,
  type ValidatedFulfillSupplyRequestInput,
} from "./lifecycle-validation";
import {
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
  supplyRequestDateToUtc,
} from "./validation";
import { supplyRequestNewYorkWallClock } from "./wall-clock";

type LifecycleKind = "FULFILLED" | "CANCELLED";

export type SupplyRequestLifecycleResult<
  TStatus extends Extract<SupplyRequestStatus, "FULFILLED" | "CANCELLED">,
> = Readonly<{
  supplyRequestId: string;
  namReference: string;
  currentVersionId: string;
  newVersionNumber: number;
  status: TStatus;
}>;

export type FulfillSupplyRequestResult =
  SupplyRequestLifecycleResult<"FULFILLED">;
export type CancelSupplyRequestResult =
  SupplyRequestLifecycleResult<"CANCELLED">;

export type SupplyRequestLifecycleDependencies = Readonly<{
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

type LoadedCurrentVersion = Prisma.SupplyRequestVersionGetPayload<{
  select: typeof currentVersionSelect;
}>;

type ValidatedLifecycleInput =
  | ValidatedFulfillSupplyRequestInput
  | ValidatedCancelSupplyRequestInput;

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentDateKey(value: unknown) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const key = dateKey(value);
  return isCanonicalSupplyRequestDate(key) ? key : null;
}

function invalidCurrentVersion(): never {
  throw new SupplyRequestLifecycleError(
    "CURRENT_VERSION_INVALID",
    "The Supply Request current-version state is invalid and could not be updated in NAM.",
  );
}

function assertCurrentVersionNumber(versionNumber: number) {
  if (
    !Number.isSafeInteger(versionNumber) ||
    versionNumber < 1 ||
    versionNumber > 2_147_483_647
  ) {
    invalidCurrentVersion();
  }
}

function assertCompleteRequestedVersion(version: LoadedCurrentVersion) {
  const operationalWorkDate = currentDateKey(version.operationalWorkDate);
  const submittedLocalDate = currentDateKey(version.submittedLocalDate);
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
    (version.changeKind === "CREATED" && !hasAnyCorrection) ||
    (version.changeKind === "CORRECTED" && hasCompleteCorrection);
  if (
    version.status !== "REQUESTED" ||
    !operationalWorkDate ||
    !submittedLocalDate ||
    !isCanonicalSupplyRequestLocalTime(version.submittedLocalTime) ||
    version.fulfillmentOperationalWorkDate !== null ||
    version.fulfilledLocalDate !== null ||
    version.fulfilledLocalTime !== null ||
    version.fulfillmentNote !== null ||
    version.cancelledLocalDate !== null ||
    version.cancelledLocalTime !== null ||
    version.cancellationReason !== null ||
    !correctionIsCoherent ||
    version.items.length === 0 ||
    version.items.length > 50 ||
    version.items.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 999_999,
    ) ||
    version.items.some((item, index) => item.sequence !== index + 1)
  ) {
    invalidCurrentVersion();
  }

  return { operationalWorkDate, submittedLocalDate };
}

function nextId(generateId: () => string) {
  const id = generateId();
  if (typeof id !== "string" || id.trim().length === 0) {
    throw unexpectedSupplyRequestLifecycleError();
  }
  return id;
}

async function lockAndLoadCurrentVersion(
  transaction: Prisma.TransactionClient,
  supplyRequestId: string,
) {
  const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "SupplyRequest"
      WHERE "id" = ${supplyRequestId}
      FOR UPDATE
    `,
  );
  if (lockedRows.length === 0) {
    throw new SupplyRequestLifecycleError(
      "REQUEST_NOT_FOUND",
      "The Supply Request could not be found.",
    );
  }
  if (
    lockedRows.length !== 1 ||
    typeof lockedRows[0]?.id !== "string" ||
    lockedRows[0].id !== supplyRequestId
  ) {
    invalidCurrentVersion();
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
    invalidCurrentVersion();
  }
  return { root, current: root.currentVersion };
}

function copiedVersionData(
  current: LoadedCurrentVersion,
  versionId: string,
  newVersionNumber: number,
  kind: LifecycleKind,
  lifecycleDate: string,
  lifecycleTime: string,
  input: ValidatedLifecycleInput,
  generateId: () => string,
): Prisma.SupplyRequestVersionUncheckedCreateInput {
  const fulfillment =
    kind === "FULFILLED"
      ? (input as ValidatedFulfillSupplyRequestInput)
      : null;
  const cancellation =
    kind === "CANCELLED"
      ? (input as ValidatedCancelSupplyRequestInput)
      : null;

  return {
    id: versionId,
    supplyRequestId: current.supplyRequestId,
    versionNumber: newVersionNumber,
    changeKind: kind,
    status: kind,
    operationalWorkDate: current.operationalWorkDate,
    submittedLocalDate: current.submittedLocalDate,
    submittedLocalTime: current.submittedLocalTime,
    equipmentId: current.equipmentId,
    equipmentDisplayNameSnapshot: current.equipmentDisplayNameSnapshot,
    equipmentNumberSnapshot: current.equipmentNumberSnapshot,
    equipmentCategorySnapshot: current.equipmentCategorySnapshot,
    mineNameSnapshot: current.mineNameSnapshot,
    cityNameSnapshot: current.cityNameSnapshot,
    cityStateSnapshot: current.cityStateSnapshot,
    requesterDisplayNameSnapshot: current.requesterDisplayNameSnapshot,
    requesterEmployeeNumberSnapshot: current.requesterEmployeeNumberSnapshot,
    supervisorId: current.supervisorId,
    supervisorNameSnapshot: current.supervisorNameSnapshot,
    supervisorEmailSnapshot: current.supervisorEmailSnapshot,
    notes: current.notes,
    fulfillmentOperationalWorkDate: fulfillment
      ? supplyRequestDateToUtc(fulfillment.fulfillmentOperationalWorkDate)
      : null,
    fulfilledLocalDate: fulfillment
      ? supplyRequestDateToUtc(lifecycleDate)
      : null,
    fulfilledLocalTime: fulfillment ? lifecycleTime : null,
    fulfillmentNote: fulfillment?.fulfillmentNote ?? null,
    cancelledLocalDate: cancellation
      ? supplyRequestDateToUtc(lifecycleDate)
      : null,
    cancelledLocalTime: cancellation ? lifecycleTime : null,
    cancellationReason: cancellation?.cancellationReason ?? null,
    correctionReason: null,
    correctedByDisplayNameSnapshot: null,
    correctionLocalDate: null,
    correctionLocalTime: null,
    items: {
      create: current.items.map((item) => ({
        id: nextId(generateId),
        supplyItemId: item.supplyItemId,
        sequence: item.sequence,
        quantity: item.quantity,
        itemNumberSnapshot: item.itemNumberSnapshot,
        normalizedItemNumberSnapshot: item.normalizedItemNumberSnapshot,
        descriptionSnapshot: item.descriptionSnapshot,
        unitOfMeasureSnapshot: item.unitOfMeasureSnapshot,
      })),
    },
  };
}

async function lifecycleAttempt(
  client: PrismaClient,
  kind: LifecycleKind,
  input: ValidatedLifecycleInput,
  lifecycleDate: string,
  lifecycleTime: string,
  generateId: () => string,
): Promise<SupplyRequestLifecycleResult<"FULFILLED" | "CANCELLED">> {
  return client.$transaction(
    async (transaction) => {
      const { root, current } = await lockAndLoadCurrentVersion(
        transaction,
        input.supplyRequestId,
      );

      assertCurrentVersionNumber(current.versionNumber);
      if (input.expectedCurrentVersionNumber !== current.versionNumber) {
        throw new SupplyRequestLifecycleError(
          "STALE_VERSION",
          "This Supply Request changed after the form was loaded. Reload the current request before trying again.",
          "expectedCurrentVersionNumber",
        );
      }
      if (current.status !== "REQUESTED") {
        throw new SupplyRequestLifecycleError(
          "INVALID_TRANSITION",
          `This Supply Request is already ${current.status.toLowerCase()} and cannot receive another normal lifecycle action.`,
        );
      }
      const currentFacts = assertCompleteRequestedVersion(current);

      if (
        !isCanonicalSupplyRequestDate(lifecycleDate) ||
        !isCanonicalSupplyRequestLocalTime(lifecycleTime) ||
        isLifecycleWallClockBeforeSubmission(
          lifecycleDate,
          lifecycleTime,
          currentFacts.submittedLocalDate,
          current.submittedLocalTime,
        )
      ) {
        throw new SupplyRequestLifecycleError(
          "LIFECYCLE_TIME_BEFORE_SUBMISSION",
          "The lifecycle time cannot be before the original submitted local date and time.",
        );
      }

      if (
        kind === "FULFILLED" &&
        (input as ValidatedFulfillSupplyRequestInput)
          .fulfillmentOperationalWorkDate < currentFacts.operationalWorkDate
      ) {
        throw new SupplyRequestLifecycleError(
          "FULFILLMENT_WORK_DATE_BEFORE_REQUEST",
          "Fulfillment operational work date cannot be before the request operational work date.",
          "fulfillmentOperationalWorkDate",
        );
      }

      const newVersionNumber = current.versionNumber + 1;
      if (
        !Number.isSafeInteger(newVersionNumber) ||
        newVersionNumber > 2_147_483_647
      ) {
        invalidCurrentVersion();
      }

      const versionId = nextId(generateId);
      const version = await transaction.supplyRequestVersion.create({
        data: copiedVersionData(
          current,
          versionId,
          newVersionNumber,
          kind,
          lifecycleDate,
          lifecycleTime,
          input,
          generateId,
        ),
        select: { id: true, versionNumber: true, status: true },
      });

      const updatedRoot = await transaction.supplyRequest.update({
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
      if (updatedRoot.currentVersionId !== version.id) {
        invalidCurrentVersion();
      }

      return {
        supplyRequestId: updatedRoot.id,
        namReference: updatedRoot.namReference,
        currentVersionId: version.id,
        newVersionNumber: version.versionNumber,
        status: kind,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

async function transitionWithDependencies(
  kind: LifecycleKind,
  input: FulfillSupplyRequestInput | CancelSupplyRequestInput,
  dependencies: SupplyRequestLifecycleDependencies,
) {
  try {
    const parsed =
      kind === "FULFILLED"
        ? parseFulfillSupplyRequestInput(input as FulfillSupplyRequestInput)
        : parseCancelSupplyRequestInput(input as CancelSupplyRequestInput);
    const clock = supplyRequestNewYorkWallClock(
      (dependencies.now ?? (() => new Date()))(),
    );
    const generateId = dependencies.generateId ?? randomUUID;
    return await runSupplyRequestLifecycleWithRetry(() =>
      lifecycleAttempt(
        dependencies.client,
        kind,
        parsed,
        clock.date,
        clock.time,
        generateId,
      ),
    );
  } catch (error) {
    if (error instanceof SupplyRequestLifecycleError) throw error;
    throw unexpectedSupplyRequestLifecycleError();
  }
}

/**
 * Internal composition seam for focused tests. Application code must use the
 * fixed-dependency functions from lifecycle-persistence.ts.
 */
export function fulfillSupplyRequestWithDependencies(
  input: FulfillSupplyRequestInput,
  dependencies: SupplyRequestLifecycleDependencies,
): Promise<FulfillSupplyRequestResult> {
  return transitionWithDependencies("FULFILLED", input, dependencies) as Promise<
    FulfillSupplyRequestResult
  >;
}

/**
 * Internal composition seam for focused tests. Application code must use the
 * fixed-dependency functions from lifecycle-persistence.ts.
 */
export function cancelSupplyRequestWithDependencies(
  input: CancelSupplyRequestInput,
  dependencies: SupplyRequestLifecycleDependencies,
): Promise<CancelSupplyRequestResult> {
  return transitionWithDependencies("CANCELLED", input, dependencies) as Promise<
    CancelSupplyRequestResult
  >;
}
