import { describe, expect, it, vi } from "vitest";

import {
  getKnowledgeHistoricalRevisionWithClient,
  knowledgeHistoryIsCoherent,
  mapKnowledgeHistoricalRevision,
  mapKnowledgeHistory,
} from "@/features/knowledge-base/history-data-internal";

function revision(number: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `revision-${number}`,
    knowledgeRecordId: "record-1",
    revisionNumber: number,
    origin: number === 1 ? "INITIAL" : "REVISED",
    contentKind: number === 1 ? "FIELD_NOTE" : "PROCEDURE",
    trust: number === 1 ? "PERSONALLY_REVIEWED" : "UNVERIFIED",
    title: number === 1 ? "Reviewed observation" : "Current procedure",
    normalizedTitle: number === 1 ? "reviewed observation" : "current procedure",
    bodyMarkdown: number === 1
      ? "## Reviewed\n\nRetained [label](https://example.com/hidden)."
      : "## Current\n\nCurrent body.",
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
    changeSummary: number === 1 ? null : "Converted the note into a procedure.",
    reviewedAt: number === 1 ? new Date("2026-08-01T12:30:00Z") : null,
    createdAt: new Date(`2026-08-0${number}T12:00:00Z`),
    updatedAt: new Date(`2026-08-0${number}T12:30:00Z`),
    externalReferences: number === 1 ? [{
      sequence: 1,
      label: "Visible source",
      url: "https://example.com/source",
      normalizedUrl: "https://example.com/source",
    }] : [],
    ...overrides,
  };
}

function root(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-1",
    currentRevisionId: "revision-2",
    lifecycle: "ACTIVE",
    archivedAt: null,
    stateVersion: 3,
    revisions: [revision(1), revision(2)],
    ...overrides,
  } as never;
}

describe("Knowledge Base retained-history query contracts", () => {
  it("uses the explicit current pointer and stable revision-number navigation", () => {
    const history = mapKnowledgeHistory(root());
    expect(history.currentRevisionNumber).toBe(2);
    expect(history.revisions.map((item) => item.revisionNumber)).toEqual([2, 1]);
    expect(history.revisions[0]).toMatchObject({
      isCurrent: true,
      designation: "Current Unverified",
      href: "/knowledge-base/record-1/history/2",
    });
    expect(JSON.stringify(history)).not.toContain("revision-2");
  });

  it("maps one exact retained revision without exposing its internal UUID", () => {
    const view = mapKnowledgeHistoricalRevision(root(), 1);
    expect(view).toMatchObject({
      recordId: "record-1",
      revisionNumber: 1,
      isCurrent: false,
      designation: "Retained Reviewed",
      title: "Reviewed observation",
      externalReferences: [{ sequence: 1, label: "Visible source", url: "https://example.com/source" }],
    });
    expect(JSON.stringify(view)).not.toContain("revision-1");
    expect(mapKnowledgeHistoricalRevision(root(), 3)).toBeNull();
  });

  it("rejects a non-current Unverified revision instead of treating it as retained history", () => {
    const invalid: any = root();
    invalid.revisions[0].trust = "UNVERIFIED";
    invalid.revisions[0].reviewedAt = null;
    expect(knowledgeHistoryIsCoherent(invalid)).toBe(false);
    expect(() => mapKnowledgeHistory(invalid)).toThrowError(
      expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }),
    );
  });

  it.each([
    undefined,
    "",
    "0",
    "-1",
    "1.0",
    "1e2",
    "+1",
    "01",
    " 1",
    "2147483648",
    "\u00001",
    "9".repeat(400),
  ])("rejects noncanonical historical revision route value %s before querying", async (value) => {
    const client = {
      knowledgeRecord: { findUnique: vi.fn() },
    } as never;
    await expect(getKnowledgeHistoricalRevisionWithClient(
      client,
      "17da8059-d449-4c94-a306-5d1aaf0524c3",
      value,
    )).resolves.toBeNull();
    expect((client as any).knowledgeRecord.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["missing pointer", { currentRevisionId: null }],
    ["non-current pointer", { currentRevisionId: "revision-1" }],
    ["revision gap", { revisions: [revision(1), revision(2, { revisionNumber: 3 })] }],
    ["invalid change summary", { revisions: [revision(1), revision(2, { changeSummary: null })] }],
    ["blank change summary", { revisions: [revision(1), revision(2, { changeSummary: "" })] }],
    ["invalid Markdown", { revisions: [revision(1), revision(2, { bodyMarkdown: "# Disallowed" })] }],
    ["broken references", { revisions: [revision(1, { externalReferences: [{ sequence: 2, label: "Bad", url: "https://example.com", normalizedUrl: "https://example.com" }] }), revision(2)] }],
    ["too many references", { revisions: [revision(1), revision(2, {
      externalReferences: Array.from({ length: 11 }, (_, index) => ({
        sequence: index + 1,
        label: `Reference ${index + 1}`,
        url: `https://example.com/${index + 1}`,
        normalizedUrl: `https://example.com/${index + 1}`,
      })),
    })] }],
  ])("fails the whole history safely for %s", (_name, override) => {
    expect(() => mapKnowledgeHistory(root(override))).toThrowError(
      expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }),
    );
  });
});
