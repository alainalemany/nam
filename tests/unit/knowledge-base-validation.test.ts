import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { KnowledgeBaseError } from "@/features/knowledge-base/errors";
import {
  parseKnowledgeCreateFormData,
  parseKnowledgeCreateInput,
} from "@/features/knowledge-base/validation";

function input(overrides: Record<string, unknown> = {}) {
  return {
    submissionKey: randomUUID(),
    contentKind: "FIELD_NOTE",
    title: "  Startup reminder  ",
    bodyMarkdown: "## Before starting\r\n\r\nCheck the area.",
    safetyCaution: "  Verify isolation.  ",
    contextKind: "GENERAL",
    mineId: null,
    equipmentId: null,
    externalReferences: [{ label: " Manual ", url: "https://example.com/manual" }],
    ...overrides,
  };
}

function form() {
  const data = new FormData();
  data.set("submissionKey", randomUUID());
  data.set("contentKind", "FIELD_NOTE");
  data.set("title", "Startup reminder");
  data.set("bodyMarkdown", "Check the area.");
  data.set("safetyCaution", "");
  data.set("contextKind", "GENERAL");
  data.set("mineId", "");
  data.set("equipmentId", "");
  data.set("externalReferencesPayload", "[]");
  return data;
}

describe("Knowledge Base create validation", () => {
  it("normalizes all accepted creation material", () => {
    expect(parseKnowledgeCreateInput(input())).toMatchObject({
      title: "Startup reminder",
      bodyMarkdown: "## Before starting\n\nCheck the area.",
      safetyCaution: "Verify isolation.",
      contextKind: "GENERAL",
      externalReferences: [{ label: "Manual", url: "https://example.com/manual" }],
    });
  });

  it.each([
    ["GENERAL", randomUUID(), null],
    ["MINE", null, null],
    ["MINE", randomUUID(), randomUUID()],
    ["EQUIPMENT", randomUUID(), randomUUID()],
  ])("rejects contradictory %s context", (contextKind, mineId, equipmentId) => {
    expect(() => parseKnowledgeCreateInput(input({ contextKind, mineId, equipmentId }))).toThrowError(
      expect.objectContaining({ code: "INVALID_CONTEXT" }),
    );
  });

  it("rejects duplicate normalized URLs and credentialed URLs", () => {
    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [
      { label: "One", url: "https://example.com/a" },
      { label: "Two", url: "https://example.com/a" },
    ] }))).toThrowError(KnowledgeBaseError);
    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [
      { label: "Bad", url: "https://user:secret@example.com/a" },
    ] }))).toThrowError(expect.objectContaining({ code: "UNSAFE_LINK" }));
  });

  it("removes an empty fragment before duplicate comparison", () => {
    expect(parseKnowledgeCreateInput(input({ externalReferences: [
      { label: "Manual", url: "https://example.com/manual#" },
    ] })).externalReferences[0]?.url).toBe("https://example.com/manual");

    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [
      { label: "One", url: "https://example.com/manual" },
      { label: "Two", url: "https://example.com/manual#" },
    ] }))).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("enforces code-point limits and meaningful optional caution", () => {
    expect(() => parseKnowledgeCreateInput(input({ title: "😀".repeat(160) }))).not.toThrow();
    expect(() => parseKnowledgeCreateInput(input({ title: "😀".repeat(161) }))).toThrow();
    expect(() => parseKnowledgeCreateInput(input({ safetyCaution: "😀".repeat(2_000) }))).not.toThrow();
    expect(() => parseKnowledgeCreateInput(input({ safetyCaution: "😀".repeat(2_001) }))).toThrow();
    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [{ label: "😀".repeat(120), url: "https://example.com" }] }))).not.toThrow();
    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [{ label: "😀".repeat(121), url: "https://example.com" }] }))).toThrow();
    expect(() => parseKnowledgeCreateInput(input({ safetyCaution: " \t\n " }))).toThrowError(
      expect.objectContaining({ field: "safetyCaution" }),
    );
  });

  it.each([
    "https://exa\tmple.com/path",
    "https://exa\nmple.com/path",
    "https://example.com/path\u0000tail",
    "https://example.com/path\u007ftail",
    "https://example.com@evil.test/path",
    "https://user:pass@example.com/path",
    "https://%75ser@example.com/path",
  ])("rejects unsafe or ambiguous URL form %j", (url) => {
    expect(() => parseKnowledgeCreateInput(input({ externalReferences: [{ label: "Unsafe", url }] }))).toThrowError(
      expect.objectContaining({ code: "UNSAFE_LINK" }),
    );
  });

  it("requires exact scalar FormData cardinality", () => {
    const data = form();
    data.append("title", "Repeated");
    expect(() => parseKnowledgeCreateFormData(data)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    const unexpected = form();
    unexpected.set("rootId", randomUUID());
    expect(() => parseKnowledgeCreateFormData(unexpected)).toThrow();
  });
});
