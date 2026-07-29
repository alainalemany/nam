import { randomUUID } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  type SupplyRequestStatus,
} from "@prisma/client";

import {
  SupplyRequestCreateError,
  unexpectedSupplyRequestPersistenceError,
} from "./errors";
import { runSupplyRequestCreateWithRetry } from "./retry";
import {
  supplyRequestRequester,
  type SupplyRequestRequesterConfiguration,
} from "./server-config";
import {
  canonicalSupplyRequestItems,
  parseCreateSupplyRequestInput,
  supplyRequestDateToUtc,
  type CreateSupplyRequestInput,
  type ValidatedCreateSupplyRequestInput,
} from "./validation";

export type CreateSupplyRequestResult = Readonly<{
  supplyRequestId: string;
  namReference: string;
  currentVersionId: string;
  versionNumber: 1;
  status: Extract<SupplyRequestStatus, "REQUESTED">;
}>;

export type SupplyRequestCreateDependencies = Readonly<{
  client: PrismaClient;
  requester?: SupplyRequestRequesterConfiguration;
}>;

type LoadedSupplyItem = Awaited<
  ReturnType<Prisma.TransactionClient["supplyItem"]["findMany"]>
>[number];

function validateRequesterConfiguration(
  requester: SupplyRequestRequesterConfiguration,
) {
  if (
    requester.displayName.trim().length === 0 ||
    requester.employeeNumber.trim().length === 0
  ) {
    throw new SupplyRequestCreateError(
      "UNEXPECTED_PERSISTENCE",
      "Supply Requests requester configuration is invalid.",
    );
  }
  return requester;
}

export function formatSupplyRequestNamReference(
  referenceYear: number,
  referenceSequence: number,
) {
  return `SR-${String(referenceYear).padStart(4, "0")}-${String(
    referenceSequence,
  ).padStart(4, "0")}`;
}

async function allocateAnnualReferenceSequence(
  transaction: Prisma.TransactionClient,
  referenceYear: number,
) {
  const rows = await transaction.$queryRaw<Array<{ lastSequence: number }>>(
    Prisma.sql`
      INSERT INTO "SupplyRequestReferenceCounter"
        ("referenceYear", "lastSequence", "createdAt", "updatedAt")
      VALUES
        (${referenceYear}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("referenceYear")
      DO UPDATE SET
        "lastSequence" = "SupplyRequestReferenceCounter"."lastSequence" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastSequence"
    `,
  );

  const sequence = rows[0]?.lastSequence;
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw unexpectedSupplyRequestPersistenceError();
  }
  return sequence;
}

function missingItemId(
  input: ValidatedCreateSupplyRequestInput,
  itemById: Map<string, LoadedSupplyItem>,
) {
  return input.items.find((item) => !itemById.has(item.supplyItemId))
    ?.supplyItemId;
}

async function createSupplyRequestAttempt(
  client: PrismaClient,
  requester: SupplyRequestRequesterConfiguration,
  input: ValidatedCreateSupplyRequestInput,
): Promise<CreateSupplyRequestResult> {
  return client.$transaction(
    async (transaction) => {
      const equipment = await transaction.equipment.findUnique({
        where: { id: input.equipmentId },
        include: { mine: { include: { city: true } } },
      });
      if (!equipment) {
        throw new SupplyRequestCreateError(
          "EQUIPMENT_NOT_FOUND",
          "The selected Equipment could not be found.",
          "equipmentId",
        );
      }
      if (equipment.status !== "ACTIVE") {
        throw new SupplyRequestCreateError(
          "EQUIPMENT_INACTIVE",
          "Select active Equipment before recording this request in NAM.",
          "equipmentId",
        );
      }

      const supervisor = await transaction.supplyRequestSupervisor.findUnique({
        where: { id: input.supervisorId },
      });
      if (!supervisor) {
        throw new SupplyRequestCreateError(
          "SUPERVISOR_NOT_FOUND",
          "The selected supervisor could not be found.",
          "supervisorId",
        );
      }
      if (!supervisor.active) {
        throw new SupplyRequestCreateError(
          "SUPERVISOR_INACTIVE",
          "Select an active supervisor before recording this request in NAM.",
          "supervisorId",
        );
      }

      const itemIds = input.items.map((item) => item.supplyItemId);
      const loadedItems = await transaction.supplyItem.findMany({
        where: { id: { in: itemIds } },
      });
      const itemById = new Map(loadedItems.map((item) => [item.id, item]));
      const missingId = missingItemId(input, itemById);
      if (missingId) {
        throw new SupplyRequestCreateError(
          "SUPPLY_ITEM_NOT_FOUND",
          "One or more selected Supply Items could not be found.",
          "items",
        );
      }

      const orderedItems = canonicalSupplyRequestItems(input.items).map(
        (selected) => {
          const item = itemById.get(selected.supplyItemId);
          if (!item) {
            throw unexpectedSupplyRequestPersistenceError();
          }
          if (!item.active) {
            throw new SupplyRequestCreateError(
              "SUPPLY_ITEM_INACTIVE",
              `Supply Item ${item.itemNumber} is inactive.`,
              "items",
            );
          }
          return { selected, item };
        },
      );

      if (
        new Set(orderedItems.map(({ item }) => item.normalizedItemNumber))
          .size !== orderedItems.length
      ) {
        throw new SupplyRequestCreateError(
          "DUPLICATE_ITEM_SELECTION",
          "Each normalized Supply Item Number may appear only once in a Supply Request.",
          "items",
        );
      }

      const referenceYear = Number(input.submittedLocalDate.slice(0, 4));
      const referenceSequence = await allocateAnnualReferenceSequence(
        transaction,
        referenceYear,
      );
      const namReference = formatSupplyRequestNamReference(
        referenceYear,
        referenceSequence,
      );
      const rootId = randomUUID();
      const versionId = randomUUID();

      const root = await transaction.supplyRequest.create({
        data: {
          id: rootId,
          namReference,
          referenceYear,
          referenceSequence,
        },
        select: { id: true },
      });

      const version = await transaction.supplyRequestVersion.create({
        data: {
          id: versionId,
          supplyRequestId: root.id,
          versionNumber: 1,
          changeKind: "CREATED",
          status: "REQUESTED",
          operationalWorkDate: supplyRequestDateToUtc(
            input.operationalWorkDate,
          ),
          submittedLocalDate: supplyRequestDateToUtc(input.submittedLocalDate),
          submittedLocalTime: input.submittedLocalTime,
          equipmentId: equipment.id,
          equipmentDisplayNameSnapshot: equipment.displayName,
          equipmentNumberSnapshot: equipment.equipmentNumber,
          equipmentCategorySnapshot: equipment.category,
          mineNameSnapshot: equipment.mine.name,
          cityNameSnapshot: equipment.mine.city.name,
          cityStateSnapshot: equipment.mine.city.state,
          requesterDisplayNameSnapshot: requester.displayName,
          requesterEmployeeNumberSnapshot: requester.employeeNumber,
          supervisorId: supervisor.id,
          supervisorNameSnapshot: supervisor.fullName,
          supervisorEmailSnapshot: supervisor.email,
          notes: input.notes ?? null,
          items: {
            create: orderedItems.map(({ selected, item }) => ({
              id: randomUUID(),
              sequence: selected.sequence,
              supplyItemId: item.id,
              quantity: selected.quantity,
              itemNumberSnapshot: item.itemNumber,
              normalizedItemNumberSnapshot: item.normalizedItemNumber,
              descriptionSnapshot: item.description,
              unitOfMeasureSnapshot: item.unitOfMeasure,
            })),
          },
        },
        select: {
          id: true,
          versionNumber: true,
          status: true,
        },
      });

      const completedRoot = await transaction.supplyRequest.update({
        where: { id: root.id },
        data: { currentVersionId: version.id },
        select: {
          id: true,
          namReference: true,
          currentVersionId: true,
        },
      });
      if (!completedRoot.currentVersionId) {
        throw unexpectedSupplyRequestPersistenceError();
      }

      return {
        supplyRequestId: completedRoot.id,
        namReference: completedRoot.namReference,
        currentVersionId: completedRoot.currentVersionId,
        versionNumber: 1,
        status: "REQUESTED",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}

/**
 * Internal composition seam for real PostgreSQL integration tests.
 *
 * Application callers must use createSupplyRequest from persistence.ts so they
 * cannot replace the database client or requester snapshots.
 */
export async function createSupplyRequestWithDependencies(
  input: CreateSupplyRequestInput,
  dependencies: SupplyRequestCreateDependencies,
): Promise<CreateSupplyRequestResult> {
  const parsed = parseCreateSupplyRequestInput(input);
  const client = dependencies.client;
  const requester = validateRequesterConfiguration(
    dependencies.requester ?? supplyRequestRequester,
  );

  try {
    return await runSupplyRequestCreateWithRetry(() =>
      createSupplyRequestAttempt(client, requester, parsed),
    );
  } catch (error) {
    if (error instanceof SupplyRequestCreateError) throw error;
    throw unexpectedSupplyRequestPersistenceError();
  }
}
