// @vitest-environment node

import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { guardedKnowledgeBaseDatabaseUrl } from "../helpers/knowledge-base-postgres-guard";

const testPrefix = "kb-foundation-";
const phaseRootIds = new Set<string>();
const phaseEquipmentIds = new Set<string>();
const phaseMineIds = new Set<string>();
const phaseCityIds = new Set<string>();

const databaseUrl = guardedKnowledgeBaseDatabaseUrl();
const describePostgres = databaseUrl ? describe : describe.skip;
const client = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : undefined;

class RollbackProbe extends Error {}

function fingerprint(character = "a") {
  return character.repeat(64);
}

function isCheckConstraintViolation(constraintName: string) {
  return (error: unknown) =>
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes('code: "23514"') &&
    error.message.includes(`check constraint \\\"${constraintName}\\\"`);
}

function isRestrictConstraintViolation(constraintName: string) {
  return (error: unknown) =>
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes('code: "23001"') &&
    error.message.includes(`constraint \\\"${constraintName}\\\"`);
}

function rootData(
  overrides: Partial<Prisma.KnowledgeRecordUncheckedCreateInput> = {},
): Prisma.KnowledgeRecordUncheckedCreateInput {
  const id = overrides.id ?? randomUUID();
  phaseRootIds.add(id);
  return {
    id,
    createSubmissionKey: randomUUID(),
    createSubmissionFingerprint: fingerprint(),
    lifecycle: "ACTIVE",
    stateVersion: 1,
    ...overrides,
  };
}

function revisionData(
  knowledgeRecordId: string,
  overrides: Partial<Prisma.KnowledgeRecordRevisionUncheckedCreateInput> = {},
): Prisma.KnowledgeRecordRevisionUncheckedCreateInput {
  return {
    id: randomUUID(),
    knowledgeRecordId,
    revisionNumber: 1,
    origin: "INITIAL",
    contentKind: "FIELD_NOTE",
    trust: "UNVERIFIED",
    title: `${testPrefix}${randomUUID()}`,
    normalizedTitle: `${testPrefix}${randomUUID()}`,
    bodyMarkdown: "Reusable operational knowledge.",
    contextKind: "GENERAL",
    ...overrides,
  };
}

async function createAggregate(
  rootOverrides: Partial<Prisma.KnowledgeRecordUncheckedCreateInput> = {},
  revisionOverrides: Partial<Prisma.KnowledgeRecordRevisionUncheckedCreateInput> = {},
) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  return client.$transaction(async (transaction) => {
    const root = await transaction.knowledgeRecord.create({
      data: rootData(rootOverrides),
    });
    const revision = await transaction.knowledgeRecordRevision.create({
      data: revisionData(root.id, revisionOverrides),
    });
    const completed = await transaction.knowledgeRecord.update({
      where: { id: root.id },
      data: { currentRevisionId: revision.id },
    });
    return { root: completed, revision };
  });
}

async function cleanPhaseData() {
  if (!client) return;
  const rootIds = [...phaseRootIds];
  if (rootIds.length > 0) {
    await client.knowledgeRecord.updateMany({
      where: { id: { in: rootIds } },
      data: { currentRevisionId: null },
    });
    await client.knowledgeRecord.deleteMany({ where: { id: { in: rootIds } } });
  }
  phaseRootIds.clear();
  await client.equipment.deleteMany({
    where: { id: { in: [...phaseEquipmentIds] } },
  });
  await client.mine.deleteMany({ where: { id: { in: [...phaseMineIds] } } });
  await client.city.deleteMany({ where: { id: { in: [...phaseCityIds] } } });
  phaseEquipmentIds.clear();
  phaseMineIds.clear();
  phaseCityIds.clear();
}

async function createLocation(label: string) {
  if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
  const prefix = `${testPrefix}${label}-${randomUUID()}`;
  const city = await client.city.create({
    data: { id: `${prefix}-city`, name: `${prefix} City`, state: "WY" },
  });
  phaseCityIds.add(city.id);
  const mine = await client.mine.create({
    data: { id: `${prefix}-mine`, cityId: city.id, name: `${prefix} Mine` },
  });
  phaseMineIds.add(mine.id);
  const equipment = await client.equipment.create({
    data: {
      id: `${prefix}-equipment`,
      mineId: mine.id,
      displayName: `${prefix} Dragline`,
      equipmentNumber: "133",
      category: "DRAGLINE",
    },
  });
  phaseEquipmentIds.add(equipment.id);
  return { prefix, city, mine, equipment };
}

describePostgres("Knowledge Base foundation PostgreSQL integrity", () => {
  beforeAll(cleanPhaseData);

  afterAll(async () => {
    if (!client) return;
    try {
      await cleanPhaseData();
      await expect(client.knowledgeRecord.count()).resolves.toBe(0);
      await expect(client.knowledgeRecordRevision.count()).resolves.toBe(0);
      await expect(
        client.knowledgeRevisionExternalReference.count(),
      ).resolves.toBe(0);
    } finally {
      await client.$disconnect();
    }
  });

  it("exposes the foundation tables and physical same-owner pointer", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    await expect(client.knowledgeRecord.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(
      client.knowledgeRecordRevision.count(),
    ).resolves.toBeGreaterThanOrEqual(0);
    await expect(
      client.knowledgeRevisionExternalReference.count(),
    ).resolves.toBeGreaterThanOrEqual(0);

    const constraints = await client.$queryRaw<
      Array<{ constraint_name: string }>
    >(Prisma.sql`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = current_schema()
        AND table_name = 'KnowledgeRecord'
        AND constraint_name = 'KnowledgeRecord_currentRevision_owner_fkey'
        AND constraint_type = 'FOREIGN KEY'
    `);
    expect(constraints).toEqual([
      { constraint_name: "KnowledgeRecord_currentRevision_owner_fkey" },
    ]);
  });

  it("constructs one aggregate atomically and rejects foreign current ownership", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const first = await createAggregate();
    expect(first.root.currentRevisionId).toBe(first.revision.id);

    const second = await createAggregate();
    await expect(
      client.knowledgeRecord.update({
        where: { id: first.root.id },
        data: { currentRevisionId: second.revision.id },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      client.knowledgeRecord.update({
        where: { id: first.root.id },
        data: { currentRevisionId: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(randomUUID()),
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      client.knowledgeRecordRevision.delete({
        where: { id: first.revision.id },
      }),
    ).rejects.toSatisfy(
      isRestrictConstraintViolation(
        "KnowledgeRecord_currentRevision_owner_fkey",
      ),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(first.root.id, {
          revisionNumber: 1,
          id: randomUUID(),
        }),
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(first.root.id, {
          id: randomUUID(),
          revisionNumber: 0,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_number_check"),
    );

    const rollbackRootId = randomUUID();
    const rollbackTitle = `${testPrefix}rollback-${randomUUID()}`;
    await expect(
      client.$transaction(async (transaction) => {
        const root = await transaction.knowledgeRecord.create({
          data: rootData({ id: rollbackRootId }),
        });
        await transaction.knowledgeRecordRevision.create({
          data: revisionData(root.id, { title: rollbackTitle }),
        });
        throw new RollbackProbe();
      }),
    ).rejects.toBeInstanceOf(RollbackProbe);
    expect(
      await client.knowledgeRecordRevision.count({
        where: { title: rollbackTitle },
      }),
    ).toBe(0);
    await expect(
      client.knowledgeRecord.findUnique({ where: { id: rollbackRootId } }),
    ).resolves.toBeNull();

    const directDelete = await createAggregate();
    await client.knowledgeRecord.delete({ where: { id: directDelete.root.id } });
    await expect(
      client.knowledgeRecordRevision.findUnique({
        where: { id: directDelete.revision.id },
      }),
    ).resolves.toBeNull();
  });

  it("enforces lifecycle, state-version, submission-key, and fingerprint constraints", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    await expect(
      client.knowledgeRecord.create({
        data: rootData({ lifecycle: "ACTIVE", archivedAt: new Date() }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRecord_lifecycle_archivedAt_check"),
    );
    await expect(
      client.knowledgeRecord.create({
        data: rootData({ lifecycle: "ARCHIVED", archivedAt: null }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRecord_lifecycle_archivedAt_check"),
    );
    await expect(
      client.knowledgeRecord.create({ data: rootData({ stateVersion: 0 }) }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRecord_stateVersion_check"),
    );
    await expect(
      client.knowledgeRecord.create({
        data: rootData({ createSubmissionFingerprint: "A".repeat(64) }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRecord_fingerprint_check"),
    );
    await expect(
      client.knowledgeRecord.create({
        data: rootData({ createSubmissionFingerprint: "a".repeat(63) }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRecord_fingerprint_check"),
    );

    const submissionKey = randomUUID();
    await createAggregate({ createSubmissionKey: submissionKey });
    await expect(
      client.knowledgeRecord.create({ data: rootData({ createSubmissionKey: submissionKey }) }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      createAggregate({ createSubmissionFingerprint: fingerprint("c") }),
    ).resolves.toBeDefined();
    await expect(
      createAggregate({ createSubmissionFingerprint: fingerprint("c") }),
    ).resolves.toBeDefined();
    await expect(
      client.knowledgeRecord.create({
        data: rootData({
          lifecycle: "ARCHIVED",
          archivedAt: new Date(),
          createSubmissionFingerprint: fingerprint("b"),
        }),
      }),
    ).resolves.toMatchObject({ lifecycle: "ARCHIVED" });
  });

  it("enforces trust and revision-origin coherence while preserving RESTORED shapes", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const root = await client.knowledgeRecord.create({ data: rootData() });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, { trust: "UNVERIFIED", reviewedAt: new Date() }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_trust_reviewedAt_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, { trust: "PERSONALLY_REVIEWED", reviewedAt: null }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_trust_reviewedAt_check"),
    );

    const initial = await client.knowledgeRecordRevision.create({
      data: revisionData(root.id, {
        trust: "PERSONALLY_REVIEWED",
        reviewedAt: new Date(),
      }),
    });
    expect(initial.origin).toBe("INITIAL");
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "INITIAL",
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_origin_summary_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: null,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_origin_summary_check"),
    );
    for (const origin of ["REVISED", "RESTORED"] as const) {
      await expect(
        client.knowledgeRecordRevision.create({
          data: revisionData(root.id, {
            id: randomUUID(),
            revisionNumber: 1,
            origin,
            changeSummary: origin === "REVISED" ? "Invalid first revision" : null,
          }),
        }),
      ).rejects.toSatisfy(
        isCheckConstraintViolation("KnowledgeRevision_origin_summary_check"),
      );
    }
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "Material content update",
        }),
      }),
    ).resolves.toMatchObject({ origin: "REVISED" });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 3,
          origin: "RESTORED",
          changeSummary: null,
        }),
      }),
    ).resolves.toMatchObject({ origin: "RESTORED", trust: "UNVERIFIED" });
  });

  it("enforces exact content and summary length boundaries", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const root = await client.knowledgeRecord.create({ data: rootData() });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          title: "t".repeat(160),
          normalizedTitle: "t".repeat(160),
          bodyMarkdown: "b".repeat(50_000),
          safetyCaution: "c".repeat(2_000),
        }),
      }),
    ).resolves.toBeDefined();

    const unicodeRoot = await client.knowledgeRecord.create({ data: rootData() });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(unicodeRoot.id, {
          title: "é".repeat(160),
          normalizedTitle: "é".repeat(160),
        }),
      }),
    ).resolves.toBeDefined();

    for (const { invalid, constraint } of [
      {
        invalid: { title: "", normalizedTitle: "valid", bodyMarkdown: "valid" },
        constraint: "KnowledgeRevision_title_check",
      },
      {
        invalid: { title: "   ", normalizedTitle: "valid", bodyMarkdown: "valid" },
        constraint: "KnowledgeRevision_title_check",
      },
      {
        invalid: {
          title: "t".repeat(161),
          normalizedTitle: "valid",
          bodyMarkdown: "valid",
        },
        constraint: "KnowledgeRevision_title_check",
      },
      {
        invalid: { title: "valid", normalizedTitle: "", bodyMarkdown: "valid" },
        constraint: "KnowledgeRevision_normalizedTitle_check",
      },
      {
        invalid: {
          title: "valid",
          normalizedTitle: "\n",
          bodyMarkdown: "valid",
        },
        constraint: "KnowledgeRevision_normalizedTitle_check",
      },
      {
        invalid: {
          title: "valid",
          normalizedTitle: "n".repeat(161),
          bodyMarkdown: "valid",
        },
        constraint: "KnowledgeRevision_normalizedTitle_check",
      },
      {
        invalid: { title: "valid", normalizedTitle: "valid", bodyMarkdown: "" },
        constraint: "KnowledgeRevision_body_check",
      },
      {
        invalid: { title: "valid", normalizedTitle: "valid", bodyMarkdown: "\t" },
        constraint: "KnowledgeRevision_body_check",
      },
      {
        invalid: {
          title: "valid",
          normalizedTitle: "valid",
          bodyMarkdown: "b".repeat(50_001),
        },
        constraint: "KnowledgeRevision_body_check",
      },
      {
        invalid: {
          title: "valid",
          normalizedTitle: "valid",
          bodyMarkdown: "valid",
          safetyCaution: " ",
        },
        constraint: "KnowledgeRevision_caution_check",
      },
      {
        invalid: {
          title: "valid",
          normalizedTitle: "valid",
          bodyMarkdown: "valid",
          safetyCaution: "c".repeat(2_001),
        },
        constraint: "KnowledgeRevision_caution_check",
      },
    ]) {
      await expect(
        client.knowledgeRecordRevision.create({
          data: revisionData(root.id, {
            id: randomUUID(),
            revisionNumber: 2,
            origin: "REVISED",
            changeSummary: "summary",
            ...invalid,
          }),
        }),
      ).rejects.toSatisfy(isCheckConstraintViolation(constraint));
    }

    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "s".repeat(501),
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_changeSummary_length_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "\t",
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_changeSummary_length_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "s".repeat(500),
        }),
      }),
    ).resolves.toBeDefined();
  });

  it("enforces General, Mine, and Equipment snapshot shapes with SetNull owner isolation", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const location = await createLocation("context");
    const general = await createAggregate();
    expect(general.revision.contextKind).toBe("GENERAL");
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(general.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "invalid general live reference",
          contextKind: "GENERAL",
          mineId: location.mine.id,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );

    const mineContext = await createAggregate({}, {
      contextKind: "MINE",
      mineId: location.mine.id,
      mineNameSnapshot: location.mine.name,
      cityNameSnapshot: location.city.name,
      cityStateSnapshot: location.city.state,
    });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(mineContext.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "invalid general shape",
          contextKind: "GENERAL",
          mineNameSnapshot: location.mine.name,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(mineContext.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "incomplete mine shape",
          contextKind: "MINE",
          mineId: location.mine.id,
          mineNameSnapshot: location.mine.name,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(mineContext.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "bad mine shape",
          contextKind: "MINE",
          equipmentDisplayNameSnapshot: "contradiction",
          mineNameSnapshot: location.mine.name,
          cityNameSnapshot: location.city.name,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(mineContext.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "blank mine snapshot",
          contextKind: "MINE",
          mineNameSnapshot: "\t",
          cityNameSnapshot: location.city.name,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );
    await expect(
      createAggregate({}, {
        contextKind: "MINE",
        mineId: null,
        mineNameSnapshot: location.mine.name,
        cityNameSnapshot: location.city.name,
        cityStateSnapshot: location.city.state,
      }),
    ).resolves.toBeDefined();

    const equipmentContext = await createAggregate({}, {
      contextKind: "EQUIPMENT",
      mineId: location.mine.id,
      equipmentId: location.equipment.id,
      equipmentDisplayNameSnapshot: location.equipment.displayName,
      equipmentNumberSnapshot: location.equipment.equipmentNumber,
      equipmentCategorySnapshot: location.equipment.category,
      mineNameSnapshot: location.mine.name,
      cityNameSnapshot: location.city.name,
      cityStateSnapshot: location.city.state,
    });
    await expect(
      client.knowledgeRecordRevision.create({
        data: revisionData(equipmentContext.root.id, {
          id: randomUUID(),
          revisionNumber: 2,
          origin: "REVISED",
          changeSummary: "incomplete equipment",
          contextKind: "EQUIPMENT",
          mineNameSnapshot: location.mine.name,
          cityNameSnapshot: location.city.name,
        }),
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeRevision_context_shape_check"),
    );
    await expect(
      createAggregate({}, {
        contextKind: "EQUIPMENT",
        mineId: null,
        equipmentId: null,
        equipmentDisplayNameSnapshot: location.equipment.displayName,
        equipmentNumberSnapshot: location.equipment.equipmentNumber,
        equipmentCategorySnapshot: location.equipment.category,
        mineNameSnapshot: location.mine.name,
        cityNameSnapshot: location.city.name,
        cityStateSnapshot: location.city.state,
      }),
    ).resolves.toBeDefined();

    await client.equipment.delete({ where: { id: location.equipment.id } });
    expect(
      await client.knowledgeRecordRevision.findUnique({
        where: { id: equipmentContext.revision.id },
      }),
    ).toMatchObject({
      equipmentId: null,
      mineId: location.mine.id,
      equipmentDisplayNameSnapshot: location.equipment.displayName,
    });
    await client.mine.delete({ where: { id: location.mine.id } });
    expect(
      await client.knowledgeRecordRevision.findUnique({
        where: { id: mineContext.revision.id },
      }),
    ).toMatchObject({ mineId: null, mineNameSnapshot: location.mine.name });
    expect(
      await client.knowledgeRecordRevision.findUnique({
        where: { id: equipmentContext.revision.id },
      }),
    ).toMatchObject({
      equipmentId: null,
      mineId: null,
      equipmentDisplayNameSnapshot: location.equipment.displayName,
      mineNameSnapshot: location.mine.name,
      cityNameSnapshot: location.city.name,
    });
    await expect(client.city.findUnique({ where: { id: location.city.id } })).resolves.not.toBeNull();
  });

  it("enforces ordered HTTPS references, ten-row cardinality, uniqueness, and cascades", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const aggregate = await createAggregate();
    await client.knowledgeRevisionExternalReference.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        id: randomUUID(),
        knowledgeRecordRevisionId: aggregate.revision.id,
        sequence: index + 1,
        label: `Reference ${index + 1}`,
        url: `https://example.com/reference-${index + 1}`,
        normalizedUrl: `https://example.com/reference-${index + 1}`,
      })),
    });
    expect(
      await client.knowledgeRevisionExternalReference.count({
        where: { knowledgeRecordRevisionId: aggregate.revision.id },
      }),
    ).toBe(10);
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 11,
          label: "Eleventh",
          url: "https://example.com/eleventh",
          normalizedUrl: "https://example.com/eleventh",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_sequence_check"),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: -1,
          label: "Negative",
          url: "https://example.com/negative",
          normalizedUrl: "https://example.com/negative",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_sequence_check"),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 0,
          label: "Zero",
          url: "https://example.com/zero",
          normalizedUrl: "https://example.com/zero",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_sequence_check"),
    );

    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 1,
          label: "Duplicate sequence",
          url: "https://example.com/duplicate-sequence",
          normalizedUrl: "https://example.com/duplicate-sequence",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await client.knowledgeRevisionExternalReference.delete({
      where: {
        knowledgeRecordRevisionId_sequence: {
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
        },
      },
    });
    await expect(
      client.knowledgeRecordRevision.findUnique({
        where: { id: aggregate.revision.id },
      }),
    ).resolves.not.toBeNull();
    const urlPrefix = "https://example.com/";
    const boundaryUrl = `${urlPrefix}${"x".repeat(2_048 - urlPrefix.length)}`;
    const boundaryReference = await client.knowledgeRevisionExternalReference.create({
      data: {
        id: randomUUID(),
        knowledgeRecordRevisionId: aggregate.revision.id,
        sequence: 10,
        label: "l".repeat(120),
        url: boundaryUrl,
        normalizedUrl: boundaryUrl,
      },
    });
    await client.knowledgeRevisionExternalReference.delete({
      where: { id: boundaryReference.id },
    });
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "l".repeat(121),
          url: "https://example.com/label-too-long",
          normalizedUrl: "https://example.com/label-too-long",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_label_check"),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "   ",
          url: "https://example.com/blank-label",
          normalizedUrl: "https://example.com/blank-label",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_label_check"),
    );
    const overLimitUrl = `${boundaryUrl}x`;
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "URL too long",
          url: overLimitUrl,
          normalizedUrl: "https://example.com/raw-url-too-long",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_url_check"),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "Normalized URL too long",
          url: "https://example.com/normalized-url-too-long",
          normalizedUrl: overLimitUrl,
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation(
        "KnowledgeExternalReference_normalizedUrl_check",
      ),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "Duplicate URL",
          url: "https://example.com/reference-1",
          normalizedUrl: "https://example.com/reference-1",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "Unsafe URL",
          url: "http://example.com/unsafe",
          normalizedUrl: "https://example.com/unsafe-raw-url",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation("KnowledgeExternalReference_url_check"),
    );
    await expect(
      client.knowledgeRevisionExternalReference.create({
        data: {
          id: randomUUID(),
          knowledgeRecordRevisionId: aggregate.revision.id,
          sequence: 10,
          label: "Unsafe normalized URL",
          url: "https://example.com/unsafe-normalized-url",
          normalizedUrl: "http://example.com/unsafe-normalized-url",
        },
      }),
    ).rejects.toSatisfy(
      isCheckConstraintViolation(
        "KnowledgeExternalReference_normalizedUrl_check",
      ),
    );

    await client.knowledgeRecord.update({
      where: { id: aggregate.root.id },
      data: { currentRevisionId: null },
    });
    await client.knowledgeRecordRevision.delete({
      where: { id: aggregate.revision.id },
    });
    expect(
      await client.knowledgeRevisionExternalReference.count({
        where: { knowledgeRecordRevisionId: aggregate.revision.id },
      }),
    ).toBe(0);
  });

  it("clears the pointer before aggregate deletion and preserves unrelated fixtures", async () => {
    if (!client) throw new Error("Disposable PostgreSQL client is unavailable.");
    const unrelatedId = `knowledge-unrelated-${randomUUID()}-city`;
    await client.city.create({ data: { id: unrelatedId, name: unrelatedId } });
    const location = await createLocation("delete-isolation");
    const aggregate = await createAggregate({}, {
      contextKind: "EQUIPMENT",
      mineId: location.mine.id,
      equipmentId: location.equipment.id,
      equipmentDisplayNameSnapshot: location.equipment.displayName,
      equipmentNumberSnapshot: location.equipment.equipmentNumber,
      equipmentCategorySnapshot: location.equipment.category,
      mineNameSnapshot: location.mine.name,
      cityNameSnapshot: location.city.name,
      cityStateSnapshot: location.city.state,
    });
    await client.knowledgeRevisionExternalReference.create({
      data: {
        id: randomUUID(),
        knowledgeRecordRevisionId: aggregate.revision.id,
        sequence: 1,
        label: "Owned reference",
        url: "https://example.com/owned",
        normalizedUrl: "https://example.com/owned",
      },
    });
    await client.$transaction(async (transaction) => {
      await transaction.knowledgeRecord.update({
        where: { id: aggregate.root.id },
        data: { currentRevisionId: null },
      });
      await transaction.knowledgeRecord.delete({ where: { id: aggregate.root.id } });
    });
    expect(
      await client.knowledgeRecordRevision.count({
        where: { knowledgeRecordId: aggregate.root.id },
      }),
    ).toBe(0);
    expect(
      await client.knowledgeRevisionExternalReference.count({
        where: { knowledgeRecordRevisionId: aggregate.revision.id },
      }),
    ).toBe(0);
    await expect(
      client.equipment.findUnique({ where: { id: location.equipment.id } }),
    ).resolves.not.toBeNull();
    await expect(
      client.mine.findUnique({ where: { id: location.mine.id } }),
    ).resolves.not.toBeNull();
    await cleanPhaseData();
    await expect(client.city.findUnique({ where: { id: unrelatedId } })).resolves.not.toBeNull();
    await client.city.delete({ where: { id: unrelatedId } });
  });
});
