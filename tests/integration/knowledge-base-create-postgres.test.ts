// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";
import {
  createKnowledgeRecordWithDependencies,
  type KnowledgeCreateInternalHooks,
} from "@/features/knowledge-base/persistence-internal";
import { getKnowledgeDetailWithClient } from "@/features/knowledge-base/data-internal";
import type { KnowledgeCreateInput } from "@/features/knowledge-base/types";
import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl ? new PrismaClient({ datasourceUrl: databaseUrl }) : undefined;
const concurrentClient = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;
const phaseRootIds = new Set<string>();
const phaseEquipmentIds = new Set<string>();
const phaseMineIds = new Set<string>();
const phaseCityIds = new Set<string>();
let unrelatedCityId = "";

function createInput(overrides: Partial<KnowledgeCreateInput> = {}): KnowledgeCreateInput {
  return {
    submissionKey: randomUUID(),
    contentKind: "FIELD_NOTE",
    title: "Troubleshooting observation",
    bodyMarkdown: "## Symptom\n\nAlarm cleared after inspection.",
    safetyCaution: null,
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [
      { label: "Manual", url: "https://example.com/manual" },
      { label: "Procedure", url: "https://example.com/procedure?current=1#section" },
    ],
    ...overrides,
  };
}

async function create(
  input: KnowledgeCreateInput,
  hooks: KnowledgeCreateInternalHooks = {},
  databaseClient = client,
) {
  if (!databaseClient) throw new Error("Disposable Knowledge Base database is unavailable.");
  const result = await createKnowledgeRecordWithDependencies(input, {
    client: databaseClient,
    hooks,
  });
  phaseRootIds.add(result.knowledgeRecordId);
  return result;
}

function twoPartyBarrier() {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrivals += 1;
    if (arrivals === 2) release?.();
    await released;
  };
}

async function createLocation(label: string, active = true) {
  if (!client) throw new Error("Disposable Knowledge Base database is unavailable.");
  const key = `kb-create-${label}-${randomUUID()}`;
  const city = await client.city.create({ data: { id: `${key}-city`, name: `${key} City`, state: "WY" } });
  phaseCityIds.add(city.id);
  const mine = await client.mine.create({ data: { id: `${key}-mine`, cityId: city.id, name: `${key} Mine`, status: active ? "ACTIVE" : "INACTIVE" } });
  phaseMineIds.add(mine.id);
  const equipment = await client.equipment.create({ data: { id: `${key}-equipment`, mineId: mine.id, displayName: `${key} Dragline`, equipmentNumber: "133", category: "DRAGLINE", status: active ? "ACTIVE" : "INACTIVE" } });
  phaseEquipmentIds.add(equipment.id);
  return { city, mine, equipment };
}

async function cleanupPhaseRoots() {
  if (!client || phaseRootIds.size === 0) return;
  const ids = [...phaseRootIds];
  await client.knowledgeRecord.deleteMany({ where: { id: { in: ids } } });
  phaseRootIds.clear();
}

async function cleanupOwners() {
  if (!client) return;
  if (phaseEquipmentIds.size) await client.equipment.deleteMany({ where: { id: { in: [...phaseEquipmentIds] } } });
  if (phaseMineIds.size) await client.mine.deleteMany({ where: { id: { in: [...phaseMineIds] } } });
  if (phaseCityIds.size) await client.city.deleteMany({ where: { id: { in: [...phaseCityIds] } } });
  phaseEquipmentIds.clear();
  phaseMineIds.clear();
  phaseCityIds.clear();
}

describePostgres("Knowledge Base transactional create PostgreSQL evidence", () => {
  beforeAll(async () => {
    if (!client) return;
    unrelatedCityId = `kb-unrelated-${randomUUID()}`;
    await client.city.create({ data: { id: unrelatedCityId, name: unrelatedCityId, state: "WY" } });
  });

  afterEach(async () => {
    await cleanupPhaseRoots();
    await cleanupOwners();
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await cleanupPhaseRoots();
      await cleanupOwners();
      await expect(client.city.findUnique({ where: { id: unrelatedCityId } })).resolves.not.toBeNull();
      await client.city.delete({ where: { id: unrelatedCityId } });
      await expect(client.knowledgeRecord.count()).resolves.toBe(0);
      await expect(client.knowledgeRecordRevision.count()).resolves.toBe(0);
      await expect(client.knowledgeRevisionExternalReference.count()).resolves.toBe(0);
    } finally {
      await concurrentClient?.$disconnect();
      await client.$disconnect();
    }
  });

  it("creates one complete General aggregate atomically", async () => {
    if (!client) throw new Error("Missing client");
    const result = await create(createInput());
    const root = await client.knowledgeRecord.findUniqueOrThrow({ where: { id: result.knowledgeRecordId }, include: { currentRevision: { include: { externalReferences: { orderBy: { sequence: "asc" } } } }, revisions: true } });
    expect(root).toMatchObject({ lifecycle: "ACTIVE", stateVersion: 1, archivedAt: null });
    expect(root.currentRevision).toMatchObject({ knowledgeRecordId: root.id, revisionNumber: 1, origin: "INITIAL", trust: "UNVERIFIED", contextKind: "GENERAL", reviewedAt: null });
    expect(root.currentRevisionId).toBe(root.currentRevision?.id);
    expect(root.revisions).toHaveLength(1);
    expect(root.currentRevision?.externalReferences.map(({ sequence, label }) => ({ sequence, label }))).toEqual([{ sequence: 1, label: "Manual" }, { sequence: 2, label: "Procedure" }]);
  });

  it("derives coherent Mine and Equipment snapshots under owner-row protection", async () => {
    if (!client) throw new Error("Missing client");
    const location = await createLocation("contexts");
    const mineResult = await create(createInput({ submissionKey: randomUUID(), contextKind: "MINE", mineId: location.mine.id, equipmentId: null }));
    const equipmentResult = await create(createInput({ submissionKey: randomUUID(), contextKind: "EQUIPMENT", mineId: null, equipmentId: location.equipment.id }));
    const [mine, equipment] = await Promise.all([
      client.knowledgeRecordRevision.findFirstOrThrow({ where: { knowledgeRecordId: mineResult.knowledgeRecordId } }),
      client.knowledgeRecordRevision.findFirstOrThrow({ where: { knowledgeRecordId: equipmentResult.knowledgeRecordId } }),
    ]);
    expect(mine).toMatchObject({ contextKind: "MINE", mineId: location.mine.id, mineNameSnapshot: location.mine.name, cityNameSnapshot: location.city.name, cityStateSnapshot: "WY", equipmentId: null });
    expect(equipment).toMatchObject({ contextKind: "EQUIPMENT", equipmentId: location.equipment.id, mineId: location.mine.id, equipmentDisplayNameSnapshot: location.equipment.displayName, equipmentNumberSnapshot: "133", equipmentCategorySnapshot: "DRAGLINE", mineNameSnapshot: location.mine.name, cityNameSnapshot: location.city.name });
    await expect(client.mine.findUnique({ where: { id: location.mine.id } })).resolves.toMatchObject({ updatedAt: location.mine.updatedAt });
    await expect(client.equipment.findUnique({ where: { id: location.equipment.id } })).resolves.toMatchObject({ updatedAt: location.equipment.updatedAt });
  });

  it("rolls back invalid, inactive, pointer, reference, and mid-transaction failures", async () => {
    if (!client) throw new Error("Missing client");
    const inactive = await createLocation("inactive", false);
    await expect(create(createInput({ contextKind: "MINE", mineId: "missing-mine", equipmentId: null }))).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(create(createInput({ contextKind: "EQUIPMENT", mineId: null, equipmentId: "missing-equipment" }))).rejects.toMatchObject({ code: "REFERENCE_NOT_FOUND" });
    await expect(create(createInput({ contextKind: "MINE", mineId: inactive.mine.id, equipmentId: null }))).rejects.toMatchObject({ code: "REFERENCE_INACTIVE" });
    await expect(create(createInput({ contextKind: "EQUIPMENT", mineId: null, equipmentId: inactive.equipment.id }))).rejects.toMatchObject({ code: "REFERENCE_INACTIVE" });
    for (const hooks of [
      { afterReferencesInserted: async (transaction: Prisma.TransactionClient, rootId: string) => {
        const revision = await transaction.knowledgeRecordRevision.findFirstOrThrow({ where: { knowledgeRecordId: rootId } });
        await transaction.knowledgeRevisionExternalReference.create({ data: { knowledgeRecordRevisionId: revision.id, sequence: 1, label: "Duplicate", url: "https://example.com/duplicate", normalizedUrl: "https://example.com/duplicate" } });
      } },
      { afterReferencesInserted: async () => { throw new Error("mid-transaction probe"); } },
      { beforePointerAssignment: async (transaction: Prisma.TransactionClient, _rootId: string, revisionId: string) => { await transaction.knowledgeRecordRevision.delete({ where: { id: revisionId } }); } },
    ]) {
      const submissionKey = randomUUID();
      await expect(create(createInput({ submissionKey }), hooks)).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
      await expect(client.knowledgeRecord.findUnique({ where: { createSubmissionKey: submissionKey } })).resolves.toBeNull();
    }
  });

  it("reconciles identical replay and rejects changed payload under one key", async () => {
    if (!client) throw new Error("Missing client");
    const input = createInput();
    const first = await create(input);
    const replay = await create(input);
    expect(replay).toEqual({ knowledgeRecordId: first.knowledgeRecordId, duplicate: true });
    await expect(create({ ...input, title: "Changed title" })).rejects.toMatchObject({ code: "DUPLICATE_SUBMISSION_CONFLICT" });
    expect(await client.knowledgeRecord.count({ where: { createSubmissionKey: input.submissionKey } })).toBe(1);
    expect(await client.knowledgeRecordRevision.count({ where: { knowledgeRecordId: first.knowledgeRecordId } })).toBe(1);

    const ambiguousInput = createInput({ submissionKey: randomUUID() });
    const reconciled = await create(ambiguousInput, {
      afterCommit: async () => { throw new Error("ambiguous outcome probe"); },
    });
    expect(reconciled.duplicate).toBe(true);
    expect(await client.knowledgeRecord.count({ where: { createSubmissionKey: ambiguousInput.submissionKey } })).toBe(1);
  });

  it("serializes concurrent identical submissions and gives one different-payload winner", async () => {
    if (!client || !concurrentClient) throw new Error("Missing client");
    const identical = createInput();
    const identicalBarrier = twoPartyBarrier();
    const identicalResults = await Promise.all([
      create(identical, { afterContextResolved: identicalBarrier }, client),
      create(identical, { afterContextResolved: identicalBarrier }, concurrentClient),
    ]);
    expect(new Set(identicalResults.map((result) => result.knowledgeRecordId))).toHaveLength(1);
    expect(await client.knowledgeRecord.count({ where: { createSubmissionKey: identical.submissionKey } })).toBe(1);

    const differingKey = randomUUID();
    const differingBarrier = twoPartyBarrier();
    const outcomes = await Promise.allSettled([
      create(
        createInput({ submissionKey: differingKey, title: "Payload A" }),
        { afterContextResolved: differingBarrier },
        client,
      ),
      create(
        createInput({ submissionKey: differingKey, title: "Payload B" }),
        { afterContextResolved: differingBarrier },
        concurrentClient,
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(KnowledgeBaseError);
    expect(rejected.reason.code).toBe("DUPLICATE_SUBMISSION_CONFLICT");
    const winner = await client.knowledgeRecord.findUniqueOrThrow({ where: { createSubmissionKey: differingKey } });
    phaseRootIds.add(winner.id);
  });

  it("makes owner deletion racing create resolve to a coherent aggregate or safe rollback", async () => {
    if (!client || !concurrentClient) throw new Error("Missing client");
    const location = await createLocation("race");
    const input = createInput({ contextKind: "EQUIPMENT", mineId: null, equipmentId: location.equipment.id });
    let confirmLock: (() => void) | undefined;
    let releaseLock: (() => void) | undefined;
    const lockHeld = new Promise<void>((resolve) => {
      confirmLock = resolve;
    });
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const creationPromise = create(input, {
      afterContextResolved: async () => {
        confirmLock?.();
        await lockReleased;
      },
    });
    await lockHeld;
    const deletionPromise = concurrentClient.equipment.delete({
      where: { id: location.equipment.id },
    });
    releaseLock?.();
    const [creation, deletion] = await Promise.allSettled([
      creationPromise,
      deletionPromise,
    ]);
    if (deletion.status === "fulfilled") phaseEquipmentIds.delete(location.equipment.id);
    if (creation.status === "fulfilled") {
      const detail = await getKnowledgeDetailWithClient(client, creation.value.knowledgeRecordId);
      expect(detail?.context.kind).toBe("EQUIPMENT");
    } else {
      expect(creation.reason).toBeInstanceOf(KnowledgeBaseError);
      await expect(client.knowledgeRecord.findUnique({ where: { createSubmissionKey: input.submissionKey } })).resolves.toBeNull();
    }
    expect(await client.mine.findUnique({ where: { id: location.mine.id } })).not.toBeNull();
  });

  it("loads only explicit coherent current state and rejects decoys or null authority", async () => {
    if (!client) throw new Error("Missing client");
    const valid = await create(createInput());
    await expect(getKnowledgeDetailWithClient(client, valid.knowledgeRecordId)).resolves.toMatchObject({ id: valid.knowledgeRecordId, trustLabel: "Unverified" });
    await client.knowledgeRecordRevision.create({ data: { knowledgeRecordId: valid.knowledgeRecordId, revisionNumber: 2, origin: "REVISED", contentKind: "FIELD_NOTE", trust: "UNVERIFIED", title: "Decoy", normalizedTitle: "decoy", bodyMarkdown: "Decoy", contextKind: "GENERAL", changeSummary: "Decoy" } });
    await expect(getKnowledgeDetailWithClient(client, valid.knowledgeRecordId)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });

    const nullPointer = await create(createInput({ submissionKey: randomUUID() }));
    await client.knowledgeRecord.update({ where: { id: nullPointer.knowledgeRecordId }, data: { currentRevisionId: null } });
    await expect(getKnowledgeDetailWithClient(client, nullPointer.knowledgeRecordId)).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
  });

  it("uses exact-ID cleanup and preserves an unrelated fixture", async () => {
    if (!client) throw new Error("Missing client");
    const result = await create(createInput());
    expect(await client.knowledgeRecord.findUnique({ where: { id: result.knowledgeRecordId } })).not.toBeNull();
    await cleanupPhaseRoots();
    expect(await client.knowledgeRecord.findUnique({ where: { id: result.knowledgeRecordId } })).toBeNull();
    expect(await client.city.findUnique({ where: { id: unrelatedCityId } })).not.toBeNull();
  });
});
