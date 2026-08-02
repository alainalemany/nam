import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseKnowledgeArchiveFormData,
  parseKnowledgeDeleteFormData,
  parseKnowledgeRestoreFormData,
} from "@/features/knowledge-base/validation";

const recordId = randomUUID();
const revisionId = randomUUID();

function form(kind: "archive" | "restore" | "delete") {
  const data = new FormData();
  data.set("expectedStateVersion", "3");
  data.set("expectedCurrentRevisionId", revisionId);
  if (kind === "archive") data.set("archiveConfirmed", "true");
  if (kind === "restore") data.set("restoreConfirmed", "true");
  if (kind === "delete") data.set("deleteConfirmation", "Exact current title");
  return data;
}

describe("Knowledge Base lifecycle validation", () => {
  it("accepts exact archive and restore confirmation with canonical authority", () => {
    expect(parseKnowledgeArchiveFormData(recordId.toUpperCase(), form("archive"))).toEqual({
      knowledgeRecordId: recordId,
      expectedStateVersion: 3,
      expectedCurrentRevisionId: revisionId,
    });
    expect(parseKnowledgeRestoreFormData(recordId, form("restore"))).toMatchObject({
      knowledgeRecordId: recordId,
      expectedStateVersion: 3,
    });
  });

  it.each(["yes", "1", "TRUE", "on", ""])("rejects non-exact confirmation %j", (value) => {
    const data = form("archive");
    data.set("archiveConfirmed", value);
    expect(() => parseKnowledgeArchiveFormData(recordId, data)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "archiveConfirmed" }),
    );
  });

  it("rejects repeated, unexpected, and server-owned fields", () => {
    const repeated = form("restore");
    repeated.append("expectedStateVersion", "3");
    expect(() => parseKnowledgeRestoreFormData(recordId, repeated)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    for (const field of ["lifecycle", "archivedAt", "trust", "reviewedAt", "revisionNumber", "origin", "currentRevisionId", "mineId"]) {
      const data = form("archive");
      data.set(field, "untrusted");
      expect(() => parseKnowledgeArchiveFormData(recordId, data)).toThrowError(
        expect.objectContaining({ code: "INVALID_INPUT" }),
      );
    }
  });

  it.each(["0", "-1", "+1", "01", "1.0", "1e2", "2147483647", "9007199254740992", " 1"])(
    "rejects non-mutable lifecycle stateVersion %s",
    (value) => {
      const data = form("restore");
      data.set("expectedStateVersion", value);
      expect(() => parseKnowledgeRestoreFormData(recordId, data)).toThrowError(
        expect.objectContaining({ code: "INVALID_INPUT", field: "expectedStateVersion" }),
      );
    },
  );

  it("allows delete at the signed integer ceiling because delete removes the root", () => {
    const data = form("delete");
    data.set("expectedStateVersion", "2147483647");
    expect(parseKnowledgeDeleteFormData(recordId, data)).toMatchObject({
      expectedStateVersion: 2_147_483_647,
      confirmationTitle: "Exact current title",
    });
  });

  it.each([
    "exact current title",
    " Exact current title",
    "Exact current title ",
    "Exact Current Title",
  ])("preserves destructive confirmation literally for locked title comparison: %j", (value) => {
    const data = form("delete");
    data.set("deleteConfirmation", value);
    expect(parseKnowledgeDeleteFormData(recordId, data).confirmationTitle).toBe(value);
  });

  it("rejects repeated destructive confirmation and every lifecycle server-owned field", () => {
    const repeated = form("delete");
    repeated.append("deleteConfirmation", "Exact current title");
    expect(() => parseKnowledgeDeleteFormData(recordId, repeated)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    for (const field of ["lifecycle", "archivedAt", "trust", "reviewedAt", "origin", "revisionNumber", "currentRevisionId", "stateVersionIncrement", "snapshot", "childId", "ownerId"]) {
      const data = form("delete");
      data.set(field, "untrusted");
      expect(() => parseKnowledgeDeleteFormData(recordId, data)).toThrowError(
        expect.objectContaining({ code: "INVALID_INPUT" }),
      );
    }
  });

  it("rejects malformed deletion phrases, UUIDs, and extra fields", () => {
    const controlled = form("delete");
    controlled.set("deleteConfirmation", "Exact\ncurrent title");
    expect(() => parseKnowledgeDeleteFormData(recordId, controlled)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", field: "deleteConfirmation" }),
    );
    const malformed = form("delete");
    malformed.set("expectedCurrentRevisionId", "not-a-uuid");
    expect(() => parseKnowledgeDeleteFormData(recordId, malformed)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
    const extra = form("delete");
    extra.set("childId", randomUUID());
    expect(() => parseKnowledgeDeleteFormData(recordId, extra)).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});
