import { describe, expect, it, vi } from "vitest";

import {
  getKnowledgeCreatePageDataWithClient,
  getKnowledgeDetailWithClient,
  getKnowledgeEditPageDataWithClient,
  knowledgeDetailIsCoherent,
  mapKnowledgeDetail,
} from "@/features/knowledge-base/data-internal";

function record(overrides: Record<string, unknown> = {}) {
  const revision = {
    id: "revision-1", knowledgeRecordId: "record-1", revisionNumber: 1,
    origin: "INITIAL", contentKind: "FIELD_NOTE", trust: "UNVERIFIED",
    title: "Observation", normalizedTitle: "observation", bodyMarkdown: "## Symptom\n\nInspect the alarm.", safetyCaution: null,
    contextKind: "GENERAL", mineId: null, equipmentId: null,
    equipmentDisplayNameSnapshot: null, equipmentNumberSnapshot: null,
    equipmentCategorySnapshot: null, mineNameSnapshot: null, cityNameSnapshot: null,
    cityStateSnapshot: null, changeSummary: null, reviewedAt: null,
    createdAt: new Date("2026-08-01T12:00:00Z"), updatedAt: new Date("2026-08-01T12:00:00Z"),
    externalReferences: [{ sequence: 1, label: "Manual", url: "https://example.com/manual", normalizedUrl: "https://example.com/manual" }],
  };
  return {
    id: "record-1", currentRevisionId: "revision-1", lifecycle: "ACTIVE", stateVersion: 1,
    archivedAt: null, createdAt: new Date("2026-08-01T12:00:00Z"), updatedAt: new Date("2026-08-01T12:00:00Z"),
    currentRevision: revision,
    revisions: [{ id: "revision-1", revisionNumber: 1, trust: "UNVERIFIED" }],
    ...overrides,
  } as never;
}

describe("Knowledge Base create options and current detail query", () => {
  it("uses the explicit current pointer and returns a narrow JSON-safe contract", () => {
    const loaded = record();
    expect(knowledgeDetailIsCoherent(loaded)).toBe(true);
    const view = mapKnowledgeDetail(loaded);
    expect(view).toMatchObject({ id: "record-1", title: "Observation", trustLabel: "Unverified", lifecycleLabel: "Active" });
    expect(view).not.toHaveProperty("currentRevisionId");
    expect(view).not.toHaveProperty("createSubmissionKey");
    expect(view.mutationTokens).toEqual({
      expectedStateVersion: 1,
      expectedCurrentRevisionId: "revision-1",
    });
  });

  it("supports a coherent Personally Reviewed current revision without edit tokens", () => {
    const loaded: any = record({ stateVersion: 2 });
    loaded.currentRevision.trust = "PERSONALLY_REVIEWED";
    loaded.currentRevision.reviewedAt = new Date("2026-08-01T13:00:00Z");
    loaded.revisions[0].trust = "PERSONALLY_REVIEWED";
    const view = mapKnowledgeDetail(loaded);
    expect(view).toMatchObject({
      trust: "PERSONALLY_REVIEWED",
      trustLabel: "Personally Reviewed",
      reviewedAt: "2026-08-01T13:00:00.000Z",
      mutationTokens: null,
    });
  });

  it.each([
    ["null pointer", { currentRevisionId: null }],
    ["pointer mismatch", { currentRevisionId: "decoy" }],
    ["higher decoy", { revisions: [{ id: "revision-1", revisionNumber: 1, trust: "UNVERIFIED" }, { id: "revision-2", revisionNumber: 2, trust: "UNVERIFIED" }] }],
  ])("rejects %s rather than inferring authority", (_name, override) => {
    const loaded = record(override);
    expect(knowledgeDetailIsCoherent(loaded)).toBe(false);
    expect(() => mapKnowledgeDetail(loaded)).toThrowError(expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }));
  });

  it("keeps a coherent Archived record readable but exposes no mutation tokens", () => {
    const view = mapKnowledgeDetail(record({
      lifecycle: "ARCHIVED",
      archivedAt: new Date("2026-08-01T14:00:00Z"),
      stateVersion: 2,
    }));
    expect(view).toMatchObject({ lifecycleLabel: "Archived", mutationTokens: null });
  });

  it("keeps an exhausted state version readable without exposing an unsafe mutation token", async () => {
    const loaded: any = record({ stateVersion: 2_147_483_647 });
    expect(mapKnowledgeDetail(loaded).mutationTokens).toBeNull();
    const client: any = {
      knowledgeRecord: { findUnique: vi.fn().mockResolvedValue(loaded) },
    };
    await expect(getKnowledgeEditPageDataWithClient(
      client,
      "2c04dfeb-5fc2-46e5-b476-7e871851b87f",
    )).rejects.toMatchObject({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" });
  });

  it("fails safely for incoherent context or external-reference sequence", () => {
    const sequence: any = record();
    sequence.currentRevision.externalReferences[0].sequence = 2;
    expect(() => mapKnowledgeDetail(sequence)).toThrowError(
      expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }),
    );
    const context: any = record();
    context.currentRevision.contextKind = "MINE";
    context.currentRevision.mineNameSnapshot = null;
    expect(() => mapKnowledgeDetail(context)).toThrowError(
      expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }),
    );
  });

  it("returns null for malformed or missing stable IDs and safe options for active owners", async () => {
    const client: any = {
      knowledgeRecord: { findUnique: vi.fn().mockResolvedValue(null) },
      mine: { findMany: vi.fn().mockResolvedValue([{ id: "mine-1", name: "North", city: { name: "Gillette", state: "WY" } }]) },
      equipment: { findMany: vi.fn().mockResolvedValue([{ id: "equipment-1", displayName: "Dragline", equipmentNumber: "133", mine: { name: "North" } }]) },
    };
    await expect(getKnowledgeDetailWithClient(client, "not-a-uuid")).resolves.toBeNull();
    expect(client.knowledgeRecord.findUnique).not.toHaveBeenCalled();
    const options = await getKnowledgeCreatePageDataWithClient(client);
    expect(options.mines[0]?.label).toBe("North — Gillette, WY");
    expect(options.equipment[0]?.label).toBe("Dragline #133 — North");
    expect(client.mine.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" } }));
    expect(client.equipment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE" } }));
  });

  it("prepares editable values and concurrency tokens from explicit current authority", async () => {
    const loaded: any = record({ stateVersion: 4 });
    const client: any = {
      knowledgeRecord: { findUnique: vi.fn().mockResolvedValue(loaded) },
      mine: { findMany: vi.fn().mockResolvedValue([]) },
      equipment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const page = await getKnowledgeEditPageDataWithClient(
      client,
      "2c04dfeb-5fc2-46e5-b476-7e871851b87f",
    );
    expect(page).toMatchObject({
      contentKindLabel: "Field Note",
      initialState: {
        values: {
          expectedStateVersion: "4",
          expectedCurrentRevisionId: "revision-1",
          title: "Observation",
        },
      },
    });
    expect(JSON.stringify(page)).not.toContain("createSubmission");
  });

  it("rejects reviewed edit preparation while current detail remains readable", async () => {
    const loaded: any = record({ stateVersion: 2 });
    loaded.currentRevision.trust = "PERSONALLY_REVIEWED";
    loaded.currentRevision.reviewedAt = new Date();
    loaded.revisions[0].trust = "PERSONALLY_REVIEWED";
    const client: any = { knowledgeRecord: { findUnique: vi.fn().mockResolvedValue(loaded) } };
    await expect(getKnowledgeEditPageDataWithClient(
      client,
      "2c04dfeb-5fc2-46e5-b476-7e871851b87f",
    )).rejects.toMatchObject({ code: "RECORD_NOT_EDITABLE" });
  });
});
