import { describe, expect, it } from "vitest";

import {
  hasKnowledgeListFilters,
  knowledgeListHref,
  parseKnowledgeListFilters,
} from "@/features/knowledge-base/list-params";

describe("Knowledge Base list URL state", () => {
  it("uses the approved defaults and canonical empty URL", () => {
    const parsed = parseKnowledgeListFilters({});
    expect(parsed).toEqual({
      filters: { lifecycle: "ACTIVE", sort: "UPDATED_DESC", page: 1 },
      invalidParameters: [],
    });
    expect(hasKnowledgeListFilters(parsed.filters)).toBe(false);
    expect(knowledgeListHref(parsed.filters)).toBe("/knowledge-base");
  });

  it("normalizes supported filters and preserves canonical pagination state", () => {
    const { filters } = parseKnowledgeListFilters({
      q: "  Pump   Alarm ",
      lifecycle: "ALL",
      kind: "TROUBLESHOOTING",
      trust: "UNVERIFIED",
      context: "EQUIPMENT",
      mineId: "mine-1",
      equipmentId: "equipment-1",
      sort: "TITLE_ASC",
      page: "3",
    });
    expect(knowledgeListHref(filters)).toBe(
      "/knowledge-base?q=Pump+Alarm&lifecycle=ALL&kind=TROUBLESHOOTING&trust=UNVERIFIED&context=EQUIPMENT&mineId=mine-1&equipmentId=equipment-1&sort=TITLE_ASC&page=3",
    );
    expect(knowledgeListHref(filters, { q: "seal", page: 1 })).not.toContain("page=");
    expect(knowledgeListHref(filters, { q: "seal" })).not.toContain("page=");
  });

  it("uses the first repeated scalar and reports repeated, invalid, and unknown values", () => {
    const parsed = parseKnowledgeListFilters({
      q: ["first", "second"],
      lifecycle: "DELETED",
      kind: "OTHER",
      trust: "APPROVED",
      context: "CITY",
      mineId: "x".repeat(192),
      equipmentId: "bad\nvalue",
      page: "0",
      unexpected: "value",
    });
    expect(parsed.filters.q).toBe("first");
    expect(parsed.filters).toMatchObject({ lifecycle: "ACTIVE", sort: "UPDATED_DESC", page: 1 });
    expect(parsed.invalidParameters).toEqual(expect.arrayContaining([
      "q", "lifecycle", "kind", "trust", "context", "mineId", "equipmentId", "page", "unsupported parameters",
    ]));
  });

  it("bounds search and overflow-safe pages", () => {
    expect(parseKnowledgeListFilters({ q: "😀".repeat(200) }).filters.q).toHaveLength(400);
    expect(parseKnowledgeListFilters({ q: "😀".repeat(201) }).filters.q).toBeUndefined();
    expect(parseKnowledgeListFilters({ page: "42949673" }).filters.page).toBe(1);
    expect(parseKnowledgeListFilters({ page: "9007199254740992" }).filters.page).toBe(1);
  });

  it("rejects scalar controls and every malformed page shape", () => {
    for (const q of ["pump\u0000alarm", "pump\talarm", "pump\nalarm", "pump\u007falarm"]) {
      const parsed = parseKnowledgeListFilters({ q });
      expect(parsed.filters.q).toBeUndefined();
      expect(parsed.invalidParameters).toContain("q");
    }
    for (const page of ["", "-1", "+1", "1.0", "01", "1e2", "42949673"]) {
      const parsed = parseKnowledgeListFilters({ page });
      expect(parsed.filters.page).toBe(1);
      if (page) expect(parsed.invalidParameters).toContain("page");
    }
  });

  it("uses deterministic first-value and percent-decoded runtime semantics", () => {
    const parsed = parseKnowledgeListFilters({
      q: ["first", "first"],
      sort: ["TITLE_ASC", "UPDATED_DESC"],
      mineId: ["mine-1", "mine-2"],
    });
    expect(parsed.filters).toMatchObject({
      q: "first",
      sort: "TITLE_ASC",
      mineId: "mine-1",
    });
    expect(parsed.invalidParameters).toEqual(
      expect.arrayContaining(["q", "sort", "mineId"]),
    );
  });
});
