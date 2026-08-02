import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { reviseReviewedKnowledgeRecordWithDependencies } from "@/features/knowledge-base/revision-persistence-internal";
import type { KnowledgeEditInput } from "@/features/knowledge-base/types";

const recordId = randomUUID();
const oldRevisionId = randomUUID();

function oldRevision() {
  return {
    id: oldRevisionId,
    knowledgeRecordId: recordId,
    revisionNumber: 1,
    origin: "INITIAL",
    contentKind: "FIELD_NOTE",
    trust: "PERSONALLY_REVIEWED",
    title: "Reviewed observation",
    normalizedTitle: "reviewed observation",
    bodyMarkdown: "## Observation\n\nReviewed body.",
    safetyCaution: null,
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    equipmentDisplayNameSnapshot: null,
    equipmentNumberSnapshot: null,
    equipmentCategorySnapshot: null,
    mineNameSnapshot: null,
    cityNameSnapshot: null,
    cityStateSnapshot: null,
    changeSummary: null,
    reviewedAt: new Date("2026-08-01T13:00:00Z"),
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T13:00:00Z"),
    externalReferences: [{
      sequence: 1,
      label: "Original",
      url: "https://example.com/original",
      normalizedUrl: "https://example.com/original",
    }],
  };
}

function harness() {
  const retained = oldRevision();
  const state: any = {
    id: recordId,
    currentRevisionId: oldRevisionId,
    lifecycle: "ACTIVE",
    archivedAt: null,
    stateVersion: 2,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T13:00:00Z"),
    currentRevision: retained,
    revisions: [retained],
  };
  const tx: any = {
    $queryRaw: vi.fn(async () => [{ id: tx.$queryRaw.mock.calls.length === 1 ? recordId : state.currentRevisionId }]),
    knowledgeRecord: {
      findUnique: vi.fn(async () => state),
      update: vi.fn(async ({ data }: any) => {
        if (data.currentRevisionId) {
          state.currentRevisionId = data.currentRevisionId;
          state.currentRevision = state.revisions.find((item: any) => item.id === data.currentRevisionId);
        }
        if (data.stateVersion?.increment) state.stateVersion += data.stateVersion.increment;
        state.updatedAt = new Date("2026-08-02T12:00:00Z");
        return { stateVersion: state.stateVersion };
      }),
    },
    knowledgeRecordRevision: {
      findUnique: vi.fn(async ({ where }: any) => state.revisions.find((item: any) => item.id === where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const created = {
          ...data,
          createdAt: new Date("2026-08-02T12:00:00Z"),
          updatedAt: new Date("2026-08-02T12:00:00Z"),
          externalReferences: [],
        };
        state.revisions.push(created);
        return created;
      }),
    },
    knowledgeRevisionExternalReference: {
      createMany: vi.fn(async ({ data }: any) => {
        const revision = state.revisions.find((item: any) => item.id === data[0]?.knowledgeRecordRevisionId);
        if (revision) revision.externalReferences = data.map(({ sequence, label, url, normalizedUrl }: any) => ({ sequence, label, url, normalizedUrl }));
        return { count: data.length };
      }),
    },
  };
  const client: any = {
    $transaction: vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(tx)),
    knowledgeRecord: { findUnique: vi.fn(async () => state) },
    knowledgeRecordRevision: tx.knowledgeRecordRevision,
  };
  return { client, state, tx };
}

function input(overrides: Partial<KnowledgeEditInput> = {}): KnowledgeEditInput {
  return {
    knowledgeRecordId: recordId,
    expectedStateVersion: 2,
    expectedCurrentRevisionId: oldRevisionId,
    contentKind: "PROCEDURE",
    changeSummary: "Converted the observation into a procedure.",
    title: "Current procedure",
    bodyMarkdown: "## Procedure\n\nUpdated body.",
    safetyCaution: "Verify isolation.",
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [{ label: "Replacement", url: "https://example.com/replacement" }],
    ...overrides,
  };
}

describe("Knowledge Base reviewed-revision persistence", () => {
  it("creates exactly one Unverified REVISED current while retaining reviewed material", async () => {
    const { client, state, tx } = harness();
    const retainedBefore = JSON.stringify(state.revisions[0]);
    const result = await reviseReviewedKnowledgeRecordWithDependencies(input(), { client });
    expect(result).toMatchObject({ knowledgeRecordId: recordId, stateVersion: 3, duplicate: false, revisionNumber: 2 });
    expect(state.revisions).toHaveLength(2);
    expect(JSON.stringify(state.revisions[0])).toBe(retainedBefore);
    expect(state.currentRevision).toMatchObject({ revisionNumber: 2, origin: "REVISED", trust: "UNVERIFIED", contentKind: "PROCEDURE", reviewedAt: null });
    expect(state.currentRevision.externalReferences).toEqual([{ sequence: 1, label: "Replacement", url: "https://example.com/replacement", normalizedUrl: "https://example.com/replacement" }]);
    expect(tx.knowledgeRecordRevision.create).toHaveBeenCalledOnce();
  });

  it("returns a no-material-change result without creating or advancing anything", async () => {
    const { client, state, tx } = harness();
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input({
      contentKind: "FIELD_NOTE",
      title: "Reviewed observation",
      bodyMarkdown: "## Observation\n\nReviewed body.",
      safetyCaution: null,
      externalReferences: [{ label: "Original", url: "https://example.com/original" }],
    }), { client })).rejects.toMatchObject({ code: "NO_MATERIAL_CHANGE" });
    expect(state.stateVersion).toBe(2);
    expect(state.currentRevisionId).toBe(oldRevisionId);
    expect(tx.knowledgeRecordRevision.create).not.toHaveBeenCalled();
  });

  it("requires a change summary only after proving material change", async () => {
    const { client, tx } = harness();
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input({ changeSummary: null }), { client })).rejects.toMatchObject({ code: "CHANGE_SUMMARY_REQUIRED", field: "changeSummary" });
    expect(tx.knowledgeRecordRevision.create).not.toHaveBeenCalled();
  });

  it("rejects stale authority and revision-number exhaustion before insertion", async () => {
    const stale = harness();
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input({ expectedStateVersion: 1 }), { client: stale.client })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    const exhausted = harness();
    exhausted.state.currentRevision.revisionNumber = 2_147_483_647;
    exhausted.state.revisions[0].revisionNumber = 2_147_483_647;
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input(), { client: exhausted.client })).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
    expect(exhausted.tx.knowledgeRecordRevision.create).not.toHaveBeenCalled();
  });

  it("reconciles an exact ambiguous commit but rejects later unrelated material", async () => {
    const exact = harness();
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input(), {
      client: exact.client,
      hooks: { afterCommit: async () => { throw new Error("ambiguous"); } },
    })).resolves.toMatchObject({ duplicate: true, stateVersion: 3, revisionNumber: 2 });

    const changed = harness();
    await expect(reviseReviewedKnowledgeRecordWithDependencies(input(), {
      client: changed.client,
      hooks: { afterCommit: async () => {
        changed.state.currentRevision.title = "Later unrelated mutation";
        changed.state.currentRevision.normalizedTitle = "later unrelated mutation";
        throw new Error("ambiguous");
      } },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });
});
