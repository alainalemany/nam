import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  knowledgeRelationshipDataIsCoherent,
  retainedKnowledgeRelationshipMatches,
} from "@/features/knowledge-base/relationship-persistence-internal";
import {
  parseKnowledgeCreateFormData,
  parseKnowledgeEditFormData,
} from "@/features/knowledge-base/validation";

function createForm() {
  const form = new FormData();
  form.set("submissionKey", randomUUID());
  form.set("contentKind", "FIELD_NOTE");
  form.set("title", "Relationship note");
  form.set("bodyMarkdown", "## Note\n\nRelationship evidence.");
  form.set("safetyCaution", "");
  form.set("contextKind", "GENERAL");
  form.set("mineId", "");
  form.set("equipmentId", "");
  form.set("sourceDailyLogId", "daily-log-stable-id");
  form.set("relatedDefectId", "defect-stable-id");
  form.set("externalReferencesPayload", "[]");
  return form;
}

function editForm() {
  const form = createForm();
  form.delete("submissionKey");
  form.set("expectedStateVersion", "2");
  form.set("expectedCurrentRevisionId", randomUUID());
  form.set("changeSummary", "");
  form.set("retainUnavailableSourceDailyLog", "false");
  form.set("retainUnavailableRelatedDefect", "false");
  return form;
}

describe("Knowledge Base relationship boundary", () => {
  it("accepts zero or one stable owner ID and rejects repeated or untrusted relationship state", () => {
    expect(parseKnowledgeCreateFormData(createForm()).input).toMatchObject({
      sourceDailyLogId: "daily-log-stable-id",
      relatedDefectId: "defect-stable-id",
    });
    const repeated = createForm();
    repeated.append("sourceDailyLogId", "another");
    expect(() => parseKnowledgeCreateFormData(repeated)).toThrow();
    const snapshot = createForm();
    snapshot.set("sourceDailyLogDateSnapshot", "2026-08-02");
    expect(() => parseKnowledgeCreateFormData(snapshot)).toThrow();
    const label = createForm();
    label.set("relatedDefectLabel", "Untrusted label");
    expect(() => parseKnowledgeCreateFormData(label)).toThrow();
  });

  it("distinguishes removing from retaining an unavailable snapshot", () => {
    const retained = editForm();
    retained.set("sourceDailyLogId", "");
    retained.set("retainUnavailableSourceDailyLog", "true");
    expect(parseKnowledgeEditFormData(randomUUID(), retained).input).toMatchObject({
      sourceDailyLogId: null,
      retainUnavailableSourceDailyLog: true,
    });
    const invalid = editForm();
    invalid.set("retainUnavailableRelatedDefect", "yes");
    expect(() => parseKnowledgeEditFormData(randomUUID(), invalid)).toThrow();
    const contradictory = editForm();
    contradictory.set("retainUnavailableSourceDailyLog", "true");
    expect(() => parseKnowledgeEditFormData(randomUUID(), contradictory)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "sourceDailyLogId" }),
    );
  });

  it("accepts complete never-selected and snapshot-only states but rejects partial snapshots", () => {
    const absent = {
      sourceDailyLogId: null,
      sourceDailyLogDateSnapshot: null,
      sourceDailyLogShiftSnapshot: null,
      relatedDefectId: null,
      relatedDefectTitleSnapshot: null,
      relatedDefectReportedDateSnapshot: null,
    } as const;
    expect(knowledgeRelationshipDataIsCoherent(absent)).toBe(true);
    const snapshotOnly = {
      ...absent,
      sourceDailyLogDateSnapshot: new Date("2026-08-02T00:00:00.000Z"),
      sourceDailyLogShiftSnapshot: "DAY" as const,
    };
    expect(knowledgeRelationshipDataIsCoherent(snapshotOnly)).toBe(true);
    expect(retainedKnowledgeRelationshipMatches(snapshotOnly, {
      ...snapshotOnly,
      sourceDailyLogId: "deleted-owner",
    })).toBe(true);
    expect(knowledgeRelationshipDataIsCoherent({
      ...absent,
      relatedDefectTitleSnapshot: "Partial",
    })).toBe(false);
    expect(knowledgeRelationshipDataIsCoherent({
      ...absent,
      relatedDefectTitleSnapshot: "x".repeat(201),
      relatedDefectReportedDateSnapshot: new Date("2026-08-02T00:00:00.000Z"),
    })).toBe(false);
  });
});
