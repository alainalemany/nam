import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseKnowledgeEditFormData,
  parseKnowledgeEditInput,
  parseKnowledgeReviewFormData,
} from "@/features/knowledge-base/validation";

const recordId = randomUUID();
const revisionId = randomUUID();

function editForm() {
  const data = new FormData();
  data.set("expectedStateVersion", "3");
  data.set("expectedCurrentRevisionId", revisionId);
  data.set("contentKind", "FIELD_NOTE");
  data.set("changeSummary", "");
  data.set("title", "Updated field note");
  data.set("bodyMarkdown", "## Observation\n\nUpdated content.");
  data.set("safetyCaution", "Keep clear.");
  data.set("contextKind", "GENERAL");
  data.set("mineId", "");
  data.set("equipmentId", "");
  data.set(
    "externalReferencesPayload",
    JSON.stringify([{ label: "Manual", url: "https://example.com/manual" }]),
  );
  return data;
}

function reviewForm() {
  const data = new FormData();
  data.set("expectedStateVersion", "3");
  data.set("expectedCurrentRevisionId", revisionId);
  data.set("personalReviewConfirmed", "true");
  return data;
}

describe("Knowledge Base edit and personal-review validation", () => {
  it("parses the strict edit boundary and normalizes existing material", () => {
    expect(parseKnowledgeEditFormData(recordId, editForm()).input).toMatchObject({
      knowledgeRecordId: recordId,
      expectedStateVersion: 3,
      expectedCurrentRevisionId: revisionId,
      contentKind: "FIELD_NOTE",
      changeSummary: null,
      title: "Updated field note",
      contextKind: "GENERAL",
      externalReferences: [{ label: "Manual", url: "https://example.com/manual" }],
    });
  });

  it.each([
    ["repeated scalar", (data: FormData) => data.append("title", "again")],
    ["unexpected field", (data: FormData) => data.set("trust", "PERSONALLY_REVIEWED")],
    ["trust", (data: FormData) => data.set("trust", "UNVERIFIED")],
    ["lifecycle", (data: FormData) => data.set("lifecycle", "ARCHIVED")],
    ["snapshot", (data: FormData) => data.set("mineNameSnapshot", "Untrusted")],
  ])("rejects %s input outside the edit allowlist", (_name, mutate) => {
    const data = editForm();
    mutate(data);
    expect(() => parseKnowledgeEditFormData(recordId, data)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it.each(["0", "-1", "+1", "01", "1.0", "1e2", "2147483647", "9007199254740992"])(
    "rejects ambiguous or unsafe stateVersion %s",
    (value) => {
      const data = editForm();
      data.set("expectedStateVersion", value);
      expect(() => parseKnowledgeEditFormData(recordId, data)).toThrowError(
        expect.objectContaining({ code: "INVALID_INPUT", field: "expectedStateVersion" }),
      );
    },
  );

  it("rejects malformed, controlled, and repeated current-revision tokens", () => {
    const malformed = editForm();
    malformed.set("expectedCurrentRevisionId", "not-a-uuid");
    expect(() => parseKnowledgeEditFormData(recordId, malformed)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "expectedCurrentRevisionId" }),
    );
    const repeated = editForm();
    repeated.append("expectedCurrentRevisionId", randomUUID());
    expect(() => parseKnowledgeEditFormData(recordId, repeated)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("canonicalizes valid mixed-case UUID authority tokens", () => {
    const data = editForm();
    data.set("expectedCurrentRevisionId", revisionId.toUpperCase());
    expect(
      parseKnowledgeEditFormData(recordId.toUpperCase(), data).input,
    ).toMatchObject({
      knowledgeRecordId: recordId,
      expectedCurrentRevisionId: revisionId,
      contentKind: "FIELD_NOTE",
      changeSummary: null,
    });

    const review = reviewForm();
    review.set("expectedCurrentRevisionId", revisionId.toUpperCase());
    expect(
      parseKnowledgeReviewFormData(recordId.toUpperCase(), review),
    ).toMatchObject({
      knowledgeRecordId: recordId,
      expectedCurrentRevisionId: revisionId,
    });
  });

  it("normalizes reviewed-revision change summaries and rejects controls or excess length", () => {
    const valid = editForm();
    valid.set("contentKind", "REFERENCE");
    valid.set("changeSummary", "  Changed kind and clarified steps.  ");
    expect(parseKnowledgeEditFormData(recordId, valid).input).toMatchObject({
      contentKind: "REFERENCE",
      changeSummary: "Changed kind and clarified steps.",
    });

    const controlled = editForm();
    controlled.set("changeSummary", "Changed\nsteps");
    expect(() => parseKnowledgeEditFormData(recordId, controlled)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "changeSummary" }),
    );

    const tooLong = editForm();
    tooLong.set("changeSummary", "🙂".repeat(501));
    expect(() => parseKnowledgeEditFormData(recordId, tooLong)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "changeSummary" }),
    );
  });

  it("reuses content, Markdown, context, and reference validation", () => {
    expect(() => parseKnowledgeEditInput({
      knowledgeRecordId: recordId,
      expectedStateVersion: 1,
      expectedCurrentRevisionId: revisionId,
      contentKind: "FIELD_NOTE",
      changeSummary: null,
      title: "Valid",
      bodyMarkdown: "<script>alert(1)</script>",
      safetyCaution: null,
      contextKind: "MINE",
      mineId: null,
      equipmentId: null,
      externalReferences: [],
    })).toThrowError(expect.objectContaining({ code: "INVALID_MARKDOWN" }));
  });

  it("accepts a snapshot-only current context token for server-authoritative preservation", () => {
    const data = editForm();
    data.set("contextKind", "MINE");
    data.set("mineId", "");
    expect(parseKnowledgeEditFormData(recordId, data).input).toMatchObject({
      contextKind: "MINE",
      mineId: null,
      equipmentId: null,
    });
  });

  it("parses only confirmed review tokens and accepts no content", () => {
    expect(parseKnowledgeReviewFormData(recordId, reviewForm())).toEqual({
      knowledgeRecordId: recordId,
      expectedStateVersion: 3,
      expectedCurrentRevisionId: revisionId,
    });
    const unconfirmed = reviewForm();
    unconfirmed.set("personalReviewConfirmed", "false");
    expect(() => parseKnowledgeReviewFormData(recordId, unconfirmed)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "personalReviewConfirmed" }),
    );
    const content = reviewForm();
    content.set("bodyMarkdown", "not accepted");
    expect(() => parseKnowledgeReviewFormData(recordId, content)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    const reviewedAt = reviewForm();
    reviewedAt.set("reviewedAt", new Date().toISOString());
    expect(() => parseKnowledgeReviewFormData(recordId, reviewedAt)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
