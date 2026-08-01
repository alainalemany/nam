import { describe, expect, it, vi } from "vitest";

import {
  buildKnowledgeListWhere,
  escapeKnowledgeContains,
  getKnowledgeListPageWithClient,
  knowledgeListRootSelect,
  mapKnowledgeListRow,
} from "@/features/knowledge-base/list-data-internal";
import type { KnowledgeListFilters } from "@/features/knowledge-base/list-params";

const defaults: KnowledgeListFilters = {
  lifecycle: "ACTIVE",
  sort: "UPDATED_DESC",
  page: 1,
};

function root(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    currentRevisionId: "00000000-0000-4000-8000-000000000002",
    lifecycle: "ACTIVE",
    stateVersion: 1,
    archivedAt: null,
    updatedAt: new Date("2026-08-01T12:00:00Z"),
    currentRevision: {
      id: "00000000-0000-4000-8000-000000000002",
      knowledgeRecordId: "00000000-0000-4000-8000-000000000001",
      revisionNumber: 1,
      origin: "INITIAL",
      contentKind: "FIELD_NOTE",
      trust: "UNVERIFIED",
      title: "Pump observation",
      normalizedTitle: "pump observation",
      bodyMarkdown: "## Finding\n\nRead [the manual](https://hidden.example/path).",
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
      reviewedAt: null,
    },
    ...overrides,
  } as never;
}

describe("Knowledge Base list query", () => {
  it("builds pointer-owned title/body OR beneath independent AND filters", () => {
    const where = buildKnowledgeListWhere({
      ...defaults,
      q: "%_Pump",
      kind: "PROCEDURE",
      trust: "PERSONALLY_REVIEWED",
      context: "MINE",
      mineId: "mine-1",
    });
    expect(escapeKnowledgeContains("%_\\")).toBe("\\%\\_\\\\");
    expect(where).toEqual({ AND: [
      { lifecycle: "ACTIVE" },
      { currentRevision: { is: {
        OR: [
          { title: { contains: "\\%\\_Pump", mode: "insensitive" } },
          { bodyMarkdown: { contains: "\\%\\_Pump", mode: "insensitive" } },
        ],
        contentKind: "PROCEDURE",
        trust: "PERSONALLY_REVIEWED",
        contextKind: "MINE",
        mineId: "mine-1",
      } } },
    ] });
  });

  it("maps a narrow safe row from the explicit pointer", () => {
    const row = mapKnowledgeListRow(root());
    expect(row).toMatchObject({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Pump observation",
      excerpt: "Finding Read the manual.",
      contextSummary: "General",
      trustLabel: "Unverified",
      lifecycleLabel: "Active",
    });
    expect(JSON.stringify(row)).not.toContain("hidden.example");
    expect(row).not.toHaveProperty("currentRevisionId");
    expect(row).not.toHaveProperty("bodyMarkdown");
    expect(knowledgeListRootSelect).not.toHaveProperty("createSubmissionKey");
    expect(knowledgeListRootSelect).not.toHaveProperty("createSubmissionFingerprint");
  });

  it("rejects incoherent current state rather than selecting another revision", () => {
    const base = root() as unknown as { currentRevision: Record<string, unknown> };
    expect(() => mapKnowledgeListRow(root({ currentRevisionId: null }))).toThrowError(
      expect.objectContaining({ code: "PERSISTED_STATE_INTEGRITY_FAILURE" }),
    );
    expect(() => mapKnowledgeListRow(root({
      lifecycle: "ARCHIVED",
      archivedAt: null,
    }))).toThrow();
    expect(() => mapKnowledgeListRow(root({
      currentRevision: {
        ...base.currentRevision,
        contextKind: "MINE",
        mineNameSnapshot: null,
        cityNameSnapshot: "Gillette",
      },
    }))).toThrow();
  });

  it.each([
    ["REVISED", "PERSONALLY_REVIEWED", "Reviewed change"],
    ["RESTORED", "UNVERIFIED", null],
  ])("accepts coherent future %s current revisions", (origin, trust, changeSummary) => {
    const base = root() as unknown as { currentRevision: Record<string, unknown> };
    const currentRevision = {
      ...base.currentRevision,
      revisionNumber: 2,
      origin,
      trust,
      reviewedAt: trust === "PERSONALLY_REVIEWED" ? new Date("2026-08-01T13:00:00Z") : null,
      changeSummary,
    };
    expect(() => mapKnowledgeListRow(root({
      stateVersion: 3,
      currentRevision,
    }))).not.toThrow();
  });

  it("uses Repeatable Read, matching count parity, stable ordering, and no out-of-range row query", async () => {
    const transaction = {
      knowledgeRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2).mockResolvedValueOnce(2),
        findMany: vi.fn(),
      },
      mine: { findMany: vi.fn().mockResolvedValue([]) },
      equipment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const client = {
      $transaction: vi.fn(async (callback, options) => {
        expect(options).toEqual({ isolationLevel: "RepeatableRead" });
        return callback(transaction);
      }),
    };
    const result = await getKnowledgeListPageWithClient(client as never, { ...defaults, page: 3 });
    expect(result).toMatchObject({ matchingCount: 0, totalCount: 2, page: 3, outOfRange: true });
    expect(transaction.knowledgeRecord.findMany).not.toHaveBeenCalled();
  });

  it.each([
    [0, 0],
    [1, 1],
    [49, 1],
    [50, 1],
    [51, 2],
    [52, 2],
    [99, 2],
    [100, 2],
    [101, 3],
  ])("calculates %i results as %i pages", async (matchingCount, pageCount) => {
    const transaction = {
      knowledgeRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn()
          .mockResolvedValueOnce(matchingCount)
          .mockResolvedValueOnce(matchingCount)
          .mockResolvedValueOnce(matchingCount),
        findMany: vi.fn().mockResolvedValue(
          matchingCount > 0 ? [root()] : [],
        ),
      },
      mine: { findMany: vi.fn().mockResolvedValue([]) },
      equipment: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const result = await getKnowledgeListPageWithClient(client as never, defaults);
    expect(result.pageCount).toBe(pageCount);
    if (matchingCount > 0) {
      const countWhere = transaction.knowledgeRecord.count.mock.calls[0]?.[0]?.where;
      const rowWhere = transaction.knowledgeRecord.findMany.mock.calls[0]?.[0]?.where;
      expect(rowWhere).toEqual(countWhere);
    }
  });
});
