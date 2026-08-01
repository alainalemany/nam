import { describe, expect, it, vi } from "vitest";

import {
  getKnowledgeCreatePageDataWithClient,
  getKnowledgeDetailWithClient,
  knowledgeDetailIsCoherent,
  mapKnowledgeDetail,
} from "@/features/knowledge-base/data-internal";

function record(overrides: Record<string, unknown> = {}) {
  const revision = {
    id: "revision-1", knowledgeRecordId: "record-1", revisionNumber: 1,
    origin: "INITIAL", contentKind: "FIELD_NOTE", trust: "UNVERIFIED",
    title: "Observation", bodyMarkdown: "## Symptom\n\nInspect the alarm.", safetyCaution: null,
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
    expect(JSON.stringify(view)).not.toContain("revision-1");
  });

  it.each([
    ["null pointer", { currentRevisionId: null }],
    ["pointer mismatch", { currentRevisionId: "decoy" }],
    ["higher decoy", { revisions: [{ id: "revision-1", revisionNumber: 1, trust: "UNVERIFIED" }, { id: "revision-2", revisionNumber: 2, trust: "UNVERIFIED" }] }],
    ["archived root", { lifecycle: "ARCHIVED", archivedAt: new Date() }],
  ])("rejects %s rather than inferring authority", (_name, override) => {
    const loaded = record(override);
    expect(knowledgeDetailIsCoherent(loaded)).toBe(false);
    expect(() => mapKnowledgeDetail(loaded)).toThrowError(expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }));
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
});
