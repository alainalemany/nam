import type {
  Blockquote,
  Code,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Root,
  RootContent,
  Strong,
  Text,
} from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { Fragment, createElement, type ReactNode } from "react";

import {
  knowledgeMarkdownMaximumDepth,
  knowledgeMarkdownMaximumNodes,
  knowledgeMaximumBodyLength,
} from "./constants";
import { KnowledgeBaseError } from "./errors";
import {
  codePointLength,
  normalizeHttpsUrl,
  normalizeMarkdownSource,
} from "./normalization";

export const knowledgeMarkdownAllowedNodeTypes = new Set([
  "root",
  "paragraph",
  "heading",
  "list",
  "listItem",
  "strong",
  "emphasis",
  "blockquote",
  "inlineCode",
  "code",
  "link",
  "text",
]);

type KnowledgeMarkdownNode = Root | RootContent;

function markdownError(message: string): never {
  throw new KnowledgeBaseError(
    "INVALID_MARKDOWN",
    message,
    "bodyMarkdown",
  );
}

function sourceForNode(source: string, node: KnowledgeMarkdownNode) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return typeof start === "number" && typeof end === "number"
    ? source.slice(start, end)
    : "";
}

function assertSafeLink(source: string, node: Link) {
  const raw = sourceForNode(source, node);
  if (!raw.startsWith("[")) {
    markdownError("Markdown links must use a visible label.");
  }
  const label = visibleMarkdownText({ type: "root", children: node.children });
  if (label.trim().length === 0) {
    markdownError("Markdown links must use a visible label.");
  }
  try {
    normalizeHttpsUrl(node.url, "bodyMarkdown");
  } catch {
    throw new KnowledgeBaseError(
      "UNSAFE_LINK",
      "Markdown links must use credential-free HTTPS URLs.",
      "bodyMarkdown",
    );
  }
}

function assertAllowedNode(source: string, node: KnowledgeMarkdownNode): void {
  if (!knowledgeMarkdownAllowedNodeTypes.has(node.type)) {
    markdownError(`Unsupported Markdown construct: ${node.type}.`);
  }

  if (node.type === "heading" && (node.depth < 2 || node.depth > 4)) {
    markdownError("Markdown headings must use levels 2 through 4.");
  }
  if (node.type === "code") {
    if (node.meta) markdownError("Fenced code metadata is not supported.");
    if (node.lang && !/^[A-Za-z0-9_-]{1,32}$/u.test(node.lang)) {
      markdownError("Fenced code language labels must be short safe tokens.");
    }
  }
  if (node.type === "link") assertSafeLink(source, node);
}

function assertAllowedTree(source: string, root: Root) {
  const pending: Array<Readonly<{ node: KnowledgeMarkdownNode; depth: number }>> = [
    { node: root, depth: 0 },
  ];
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodes += 1;
    if (
      nodes > knowledgeMarkdownMaximumNodes ||
      current.depth > knowledgeMarkdownMaximumDepth
    ) {
      markdownError("Markdown structure is too deeply nested or complex.");
    }
    assertAllowedNode(source, current.node);
    if ("children" in current.node) {
      for (
        let index = current.node.children.length - 1;
        index >= 0;
        index -= 1
      ) {
        pending.push({
          node: current.node.children[index] as KnowledgeMarkdownNode,
          depth: current.depth + 1,
        });
      }
    }
  }
}

function assertUnsupportedSourceForms(source: string) {
  if (/^\s{0,3}[-+*]\s+\[[ xX]\]\s/mu.test(source)) {
    markdownError("Task-list controls are not supported.");
  }
  if (
    /^\s*\|?.+\|.+\|?\s*\n\s*\|?\s*:?-{3,}:?\s*\|/mu.test(source)
  ) {
    markdownError("Markdown tables are not supported.");
  }
}

export type ParsedKnowledgeMarkdown = Readonly<{
  source: string;
  root: Root;
}>;

export function parseKnowledgeMarkdown(input: string): ParsedKnowledgeMarkdown {
  const source = normalizeMarkdownSource(input);
  if (source.trim().length === 0) {
    markdownError("Body is required.");
  }
  if (codePointLength(source) > knowledgeMaximumBodyLength) {
    markdownError("Body must be 50000 characters or fewer.");
  }
  assertUnsupportedSourceForms(source);

  let root: Root;
  try {
    root = fromMarkdown(source);
  } catch {
    markdownError("Body contains invalid Markdown.");
  }
  assertAllowedTree(source, root);
  return { source, root };
}

export function visibleMarkdownText(node: KnowledgeMarkdownNode): string {
  const visible: string[] = [];
  const pending: KnowledgeMarkdownNode[] = [node];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    if (
      current.type === "text" ||
      current.type === "inlineCode" ||
      current.type === "code"
    ) {
      visible.push(current.value);
    } else if ("children" in current) {
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        pending.push(current.children[index] as KnowledgeMarkdownNode);
      }
    }
  }
  return visible.join(" ").replace(/\s+/gu, " ").trim();
}

function renderChildren(
  source: string,
  children: readonly RootContent[],
  keyPrefix: string,
) {
  return children.map((child, index) =>
    renderNode(source, child, `${keyPrefix}-${index}`),
  );
}

function renderNode(source: string, node: RootContent, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return (node as Text).value;
    case "paragraph":
      return createElement(
        "p",
        { key },
        ...renderChildren(source, (node as Paragraph).children, key),
      );
    case "heading": {
      const heading = node as Heading;
      return createElement(
        `h${heading.depth}`,
        { key },
        ...renderChildren(source, heading.children, key),
      );
    }
    case "strong":
      return createElement(
        "strong",
        { key },
        ...renderChildren(source, (node as Strong).children, key),
      );
    case "emphasis":
      return createElement(
        "em",
        { key },
        ...renderChildren(source, (node as Emphasis).children, key),
      );
    case "blockquote":
      return createElement(
        "blockquote",
        { key },
        ...renderChildren(source, (node as Blockquote).children, key),
      );
    case "inlineCode":
      return createElement("code", { key }, (node as InlineCode).value);
    case "code":
      return createElement(
        "pre",
        { key },
        createElement("code", null, (node as Code).value),
      );
    case "link": {
      const link = node as Link;
      const safeUrl = normalizeHttpsUrl(link.url, "bodyMarkdown");
      return createElement(
        "a",
        { href: safeUrl, key, rel: "noreferrer" },
        ...renderChildren(source, link.children, key),
      );
    }
    case "list": {
      const list = node as List;
      return createElement(
        list.ordered ? "ol" : "ul",
        { key, ...(list.ordered && list.start ? { start: list.start } : {}) },
        ...renderChildren(source, list.children, key),
      );
    }
    case "listItem":
      return createElement(
        "li",
        { key },
        ...renderChildren(source, (node as ListItem).children, key),
      );
    default:
      return null;
  }
}

export function KnowledgeMarkdown({ source }: { source: string }) {
  const parsed = parseKnowledgeMarkdown(source);
  return createElement(
    Fragment,
    null,
    ...parsed.root.children.map((node, index) =>
      renderNode(parsed.source, node, `knowledge-markdown-${index}`),
    ),
  );
}
