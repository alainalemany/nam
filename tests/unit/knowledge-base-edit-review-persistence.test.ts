import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  reviewKnowledgeRecordWithDependencies,
  updateUnverifiedKnowledgeRecordWithDependencies,
} from "@/features/knowledge-base/edit-review-persistence-internal";

const recordId = randomUUID();
const revisionId = randomUUID();

function aggregate() {
  const revision = {
    id: revisionId,
    knowledgeRecordId: recordId,
    revisionNumber: 1,
    origin: "INITIAL",
    contentKind: "FIELD_NOTE",
    trust: "UNVERIFIED",
    title: "Original",
    normalizedTitle: "original",
    bodyMarkdown: "## Original\n\nBody.",
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
    reviewedAt: null as Date | null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    externalReferences: [
      {
        sequence: 1,
        label: "Old",
        url: "https://example.com/old",
        normalizedUrl: "https://example.com/old",
      },
    ],
  };
  return {
    id: recordId,
    currentRevisionId: revisionId,
    lifecycle: "ACTIVE",
    stateVersion: 1,
    archivedAt: null as Date | null,
    createdAt: new Date("2026-08-01T12:00:00Z"),
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    currentRevision: revision,
    revisions: [{
      id: revisionId,
      revisionNumber: 1,
      origin: "INITIAL",
      trust: "UNVERIFIED",
      changeSummary: null,
      reviewedAt: null as Date | null,
    }],
  };
}

function clientHarness() {
  const state = aggregate();
  let query = 0;
  const tx: any = {
    $queryRaw: vi.fn(async () => {
      query += 1;
      if (query === 1) return [{ id: recordId }];
      if (query === 2) return [{ id: revisionId }];
      return [];
    }),
    knowledgeRecord: {
      findUnique: vi.fn(async () => state),
      update: vi.fn(async () => {
        state.stateVersion += 1;
        return { stateVersion: state.stateVersion };
      }),
    },
    knowledgeRecordRevision: {
      create: vi.fn(),
      update: vi.fn(async ({ data }: any) => {
        Object.assign(state.currentRevision, data);
        state.currentRevision.updatedAt = new Date();
        state.revisions[0]!.trust = state.currentRevision.trust;
        state.revisions[0]!.reviewedAt = state.currentRevision.reviewedAt;
        return state.currentRevision;
      }),
    },
    knowledgeRevisionExternalReference: {
      deleteMany: vi.fn(async () => {
        state.currentRevision.externalReferences = [];
        return { count: 1 };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        state.currentRevision.externalReferences = data.map((item: any) => ({
          sequence: item.sequence,
          label: item.label,
          url: item.url,
          normalizedUrl: item.normalizedUrl,
        }));
        return { count: data.length };
      }),
    },
  };
  const client: any = {
    $transaction: vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(tx)),
    knowledgeRecord: { findUnique: vi.fn(async () => state) },
  };
  return { client, state, tx };
}

function editInput() {
  return {
    knowledgeRecordId: recordId,
    expectedStateVersion: 1,
    expectedCurrentRevisionId: revisionId,
    contentKind: "FIELD_NOTE" as const,
    changeSummary: null,
    title: "Updated",
    bodyMarkdown: "## Updated\n\nBody.",
    safetyCaution: "Keep clear.",
    contextKind: "GENERAL" as const,
    mineId: null,
    equipmentId: null,
    externalReferences: [
      { label: "Second", url: "https://example.com/second" },
      { label: "First", url: "https://example.com/first" },
    ],
  };
}

describe("Knowledge Base edit and personal-review persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the same Unverified revision, replaces references, and increments root state once", async () => {
    const { client, state, tx } = clientHarness();
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), { client })).resolves.toEqual({
      knowledgeRecordId: recordId,
      stateVersion: 2,
      duplicate: false,
      revisionNumber: 1,
    });
    expect(state.currentRevision.id).toBe(revisionId);
    expect(state.currentRevision.revisionNumber).toBe(1);
    expect(state.currentRevision.origin).toBe("INITIAL");
    expect(state.currentRevision.trust).toBe("UNVERIFIED");
    expect(state.currentRevision.title).toBe("Updated");
    expect(state.currentRevision.externalReferences.map((item) => item.sequence)).toEqual([1, 2]);
    expect(tx.knowledgeRecordRevision.create).not.toHaveBeenCalled();
    expect(tx.knowledgeRevisionExternalReference.deleteMany).toHaveBeenCalledWith({
      where: { knowledgeRecordRevisionId: revisionId },
    });
    expect(tx.knowledgeRecord.update).toHaveBeenCalledOnce();
  });

  it("transitions trust with server time while leaving material and references unchanged", async () => {
    const { client, state, tx } = clientHarness();
    const before = JSON.stringify({
      title: state.currentRevision.title,
      body: state.currentRevision.bodyMarkdown,
      context: state.currentRevision.contextKind,
      references: state.currentRevision.externalReferences,
    });
    const reviewedAt = new Date("2026-08-01T14:30:00Z");
    await expect(reviewKnowledgeRecordWithDependencies({
      knowledgeRecordId: recordId,
      expectedStateVersion: 1,
      expectedCurrentRevisionId: revisionId,
    }, { client, now: () => reviewedAt })).resolves.toEqual({
      knowledgeRecordId: recordId,
      stateVersion: 2,
      duplicate: false,
      revisionNumber: 1,
    });
    expect(state.currentRevision.trust).toBe("PERSONALLY_REVIEWED");
    expect(state.currentRevision.reviewedAt).toEqual(reviewedAt);
    expect(JSON.stringify({
      title: state.currentRevision.title,
      body: state.currentRevision.bodyMarkdown,
      context: state.currentRevision.contextKind,
      references: state.currentRevision.externalReferences,
    })).toBe(before);
    expect(tx.knowledgeRevisionExternalReference.deleteMany).not.toHaveBeenCalled();
  });

  it("reconciles an exact duplicate review without a second version increment", async () => {
    const { client, state, tx } = clientHarness();
    state.stateVersion = 2;
    state.currentRevision.trust = "PERSONALLY_REVIEWED";
    state.currentRevision.reviewedAt = new Date();
    state.revisions[0]!.trust = "PERSONALLY_REVIEWED";
    state.revisions[0]!.reviewedAt = state.currentRevision.reviewedAt;
    await expect(reviewKnowledgeRecordWithDependencies({
      knowledgeRecordId: recordId,
      expectedStateVersion: 1,
      expectedCurrentRevisionId: revisionId,
    }, { client })).resolves.toEqual({
      knowledgeRecordId: recordId,
      stateVersion: 2,
      duplicate: true,
      revisionNumber: 1,
    });
    expect(tx.knowledgeRecord.update).not.toHaveBeenCalled();
    expect(tx.knowledgeRecordRevision.update).not.toHaveBeenCalled();
  });

  it("rejects corrupt duplicate review state instead of misclassifying it as stale", async () => {
    const { client, state } = clientHarness();
    state.stateVersion = 2;
    state.currentRevision.trust = "PERSONALLY_REVIEWED";
    state.currentRevision.reviewedAt = new Date();
    state.currentRevision.externalReferences[0]!.sequence = 2;
    state.revisions[0]!.trust = "PERSONALLY_REVIEWED";
    state.revisions[0]!.reviewedAt = state.currentRevision.reviewedAt;
    await expect(reviewKnowledgeRecordWithDependencies({
      knowledgeRecordId: recordId,
      expectedStateVersion: 1,
      expectedCurrentRevisionId: revisionId,
    }, { client })).rejects.toMatchObject({
      code: "PERSISTED_STATE_INTEGRITY_FAILURE",
    });
  });

  it("rejects stale versions, changed authority, archived roots, and reviewed edits without writes", async () => {
    const stale = clientHarness();
    stale.state.stateVersion = 2;
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), { client: stale.client })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    expect(stale.tx.knowledgeRecordRevision.update).not.toHaveBeenCalled();

    const authority = clientHarness();
    const wrong = { ...editInput(), expectedCurrentRevisionId: randomUUID() };
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(wrong, { client: authority.client })).rejects.toMatchObject({ code: "CURRENT_AUTHORITY_CHANGED" });

    const archived = clientHarness();
    archived.state.lifecycle = "ARCHIVED";
    archived.state.archivedAt = new Date();
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), { client: archived.client })).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });

    const reviewed = clientHarness();
    reviewed.state.currentRevision.trust = "PERSONALLY_REVIEWED";
    reviewed.state.currentRevision.reviewedAt = new Date();
    reviewed.state.revisions[0]!.trust = "PERSONALLY_REVIEWED";
    reviewed.state.revisions[0]!.reviewedAt = reviewed.state.currentRevision.reviewedAt;
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), { client: reviewed.client })).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });
  });

  it("rolls back fault hooks through the single transaction boundary and classifies ambiguous success", async () => {
    const failed = clientHarness();
    failed.client.$transaction.mockImplementationOnce(async (callback: any) => {
      const snapshot = structuredClone(failed.state);
      try {
        return await callback(failed.tx);
      } catch (error) {
        Object.assign(failed.state, snapshot);
        throw error;
      }
    });
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), {
      client: failed.client,
      hooks: { afterRevisionUpdated: async () => { throw new Error("fault"); } },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    expect(failed.state.currentRevision.title).toBe("Original");
    expect(failed.state.stateVersion).toBe(1);

    const ambiguous = clientHarness();
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), {
      client: ambiguous.client,
      hooks: { afterCommit: async () => { throw new Error("ambiguous"); } },
    })).resolves.toMatchObject({ stateVersion: 2, duplicate: true });

    const changedAfterCommit = clientHarness();
    await expect(reviewKnowledgeRecordWithDependencies({
      knowledgeRecordId: recordId,
      expectedStateVersion: 1,
      expectedCurrentRevisionId: revisionId,
    }, {
      client: changedAfterCommit.client,
      hooks: {
        afterCommit: async () => {
          changedAfterCommit.state.currentRevision.title = "Later mutation";
          changedAfterCommit.state.currentRevision.normalizedTitle = "later mutation";
          throw new Error("ambiguous");
        },
      },
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
  });

  it("does not reconcile after retry exhaustion that is known to have rolled back", async () => {
    const exhausted = clientHarness();
    exhausted.client.$transaction.mockRejectedValue({ code: "P2034" });
    await expect(updateUnverifiedKnowledgeRecordWithDependencies(editInput(), {
      client: exhausted.client,
    })).rejects.toMatchObject({ code: "PERSISTENCE_FAILURE" });
    expect(exhausted.client.$transaction).toHaveBeenCalledTimes(3);
    expect(exhausted.client.knowledgeRecord.findUnique).not.toHaveBeenCalled();
  });
});
