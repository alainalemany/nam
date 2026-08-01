import { describe, expect, it } from "vitest";

import { knowledgeListExcerpt } from "@/features/knowledge-base/list-data-internal";

describe("Knowledge Base list excerpts", () => {
  it("retains visible paragraph, heading, list, link-label, and code text", () => {
    const excerpt = knowledgeListExcerpt([
      "## Heading",
      "Paragraph with [Manual](https://secret.example/path) and `inline`.",
      "- First",
      "- Second",
      "```text",
      "code value",
      "```",
    ].join("\n\n"));
    expect(excerpt).toContain("Heading Paragraph with Manual and inline.");
    expect(excerpt).toContain("First Second code value");
    expect(excerpt).not.toContain("secret.example");
    expect(excerpt).not.toContain("##");
  });

  it("normalizes whitespace, supports Unicode, and bounds output to 240 code points", () => {
    expect(knowledgeListExcerpt("😀   field\n\nknowledge")).toBe("😀 field knowledge");
    expect(Array.from(knowledgeListExcerpt("a".repeat(300)))).toHaveLength(240);
    expect(knowledgeListExcerpt("a".repeat(300)).endsWith("…")).toBe(true);
  });

  it("uses the shared restricted-Markdown policy", () => {
    expect(() => knowledgeListExcerpt("# Rejected heading")).toThrowError(
      expect.objectContaining({ code: "INVALID_MARKDOWN" }),
    );
    expect(() => knowledgeListExcerpt("<script>unsafe</script>")).toThrow();
  });
});
