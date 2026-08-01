import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  KnowledgeMarkdown,
  knowledgeMarkdownAllowedNodeTypes,
  parseKnowledgeMarkdown,
  visibleMarkdownText,
} from "@/features/knowledge-base/markdown";

describe("Knowledge Base restricted Markdown policy", () => {
  it("accepts every approved construct and renders React nodes safely", () => {
    const source = [
      "## Heading",
      "### Smaller",
      "#### Smallest",
      "Paragraph with **strong**, *emphasis*, `inline`, and [manual](https://example.com/manual).",
      "> Caution",
      "- one",
      "- two",
      "1. first",
      "2. second",
      "```shell",
      "echo safe",
      "```",
    ].join("\n\n");
    expect(() => parseKnowledgeMarkdown(source)).not.toThrow();
    render(<KnowledgeMarkdown source={source} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Heading");
    expect(screen.getByRole("link", { name: "manual" })).toHaveAttribute(
      "href",
      "https://example.com/manual",
    );
    expect(document.querySelector("script")).toBeNull();
  });

  it.each([
    ["H1", "# Not allowed"],
    ["H5", "##### Not allowed"],
    ["H6", "###### Not allowed"],
    ["raw HTML", "<strong>unsafe</strong>"],
    ["image", "![label](https://example.com/a.png)"],
    ["task control", "- [ ] unfinished"],
    ["table", "| A | B |\n| --- | --- |\n| 1 | 2 |"],
    ["unsafe protocol", "[run](javascript:alert(1))"],
    ["credentialed URL", "[private](https://user:secret@example.com/)"],
    ["autolink", "<https://example.com/>"],
    ["empty label", "[](https://example.com/)"],
    ["fence metadata", "```js execute=true\nalert(1)\n```"],
    ["reference definition", "[manual][ref]\n\n[ref]: https://example.com/manual"],
  ])("rejects %s", (_name, source) => {
    expect(() => parseKnowledgeMarkdown(source)).toThrow();
  });

  it("extracts visible text without link destinations or markup", () => {
    const parsed = parseKnowledgeMarkdown("Read **this** [manual](https://secret.example/path).");
    const visible = visibleMarkdownText(parsed.root);
    expect(visible).toContain("Read this manual");
    expect(visible).not.toContain("secret.example");
    expect(visible).not.toContain("**");
  });

  it("shares one bounded allowlist and enforces body boundaries", () => {
    expect([...knowledgeMarkdownAllowedNodeTypes].sort()).toEqual([
      "blockquote", "code", "emphasis", "heading", "inlineCode", "link",
      "list", "listItem", "paragraph", "root", "strong", "text",
    ]);
    expect(() => parseKnowledgeMarkdown("😀".repeat(50_000))).not.toThrow();
    expect(() => parseKnowledgeMarkdown("a".repeat(50_001))).toThrow();
    expect(() => parseKnowledgeMarkdown(" \t\n ")).toThrow();
    expect(() => parseKnowledgeMarkdown(`${"> ".repeat(40)}deep`)).toThrowError(
      /deeply nested or complex/u,
    );
  });

  it("does not contain an HTML injection rendering escape hatch", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/features/knowledge-base/markdown.tsx", "utf8"),
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
