import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migrationPath =
  "prisma/migrations/20260801000100_knowledge_base_foundation/migration.sql";
const migration = readFileSync(migrationPath, "utf8");

function model(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  expect(match, `${name} model`).not.toBeNull();
  return match?.[0] ?? "";
}

describe("Knowledge Base persistence foundation schema", () => {
  it("adds exactly one foundation migration", () => {
    expect(
      readdirSync("prisma/migrations").filter((name) =>
        name.endsWith("_knowledge_base_foundation"),
      ),
    ).toEqual(["20260801000100_knowledge_base_foundation"]);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
  });

  it("defines the five approved feature-owned enums", () => {
    expect(schema).toMatch(
      /enum KnowledgeRecordLifecycle\s*{\s*ACTIVE\s*ARCHIVED\s*}/,
    );
    expect(schema).toMatch(
      /enum KnowledgeContentKind\s*{\s*FIELD_NOTE\s*TROUBLESHOOTING\s*PROCEDURE\s*SAFETY_REMINDER\s*REFERENCE\s*}/,
    );
    expect(schema).toMatch(
      /enum KnowledgeTrust\s*{\s*UNVERIFIED\s*PERSONALLY_REVIEWED\s*}/,
    );
    expect(schema).toMatch(
      /enum KnowledgeRevisionOrigin\s*{\s*INITIAL\s*REVISED\s*RESTORED\s*}/,
    );
    expect(schema).toMatch(
      /enum KnowledgeContextKind\s*{\s*GENERAL\s*MINE\s*EQUIPMENT\s*}/,
    );
  });

  it("defines only the three bounded Knowledge Base models", () => {
    expect(
      [...schema.matchAll(/^model (Knowledge\w+)/gm)].map((match) => match[1]),
    ).toEqual([
      "KnowledgeRecord",
      "KnowledgeRecordRevision",
      "KnowledgeRevisionExternalReference",
    ]);
    expect(model("KnowledgeRecord")).toBeTruthy();
    expect(model("KnowledgeRecordRevision")).toBeTruthy();
    expect(model("KnowledgeRevisionExternalReference")).toBeTruthy();
    expect(schema).not.toMatch(/model (KnowledgeAudit|KnowledgeTag|KnowledgeAttachment|KnowledgeRelationship|Generic)/);
  });

  it("uses UUID stable identities and stores bounded submission identity", () => {
    const root = model("KnowledgeRecord");
    expect(root).toContain("@default(uuid()) @db.Uuid");
    expect(root).toContain("createSubmissionKey");
    expect(root).toContain("@unique(map: \"KnowledgeRecord_submissionKey_key\")");
    expect(root).toContain("createSubmissionFingerprint");
    expect(root).toContain("@db.Char(64)");
    expect(migration).toContain('CONSTRAINT "KnowledgeRecord_fingerprint_check"');
    expect(migration).toContain("'^[0-9a-f]{64}$'");
  });

  it("uses one explicit same-owner current revision pointer", () => {
    const root = model("KnowledgeRecord");
    expect(root).toContain("currentRevisionId");
    expect(root).toContain("fields: [currentRevisionId, id]");
    expect(root).toContain("references: [id, knowledgeRecordId]");
    expect(root).toContain("KnowledgeRecord_currentRevision_owner_fkey");
    expect(model("KnowledgeRecordRevision")).toContain(
      '@@unique([id, knowledgeRecordId], map: "KnowledgeRevision_id_record_key")',
    );
    expect(schema).not.toMatch(/MAX\s*\(|latestRevision|current.*updatedAt/i);
  });

  it("cascades only owned revisions and external references", () => {
    expect(model("KnowledgeRecordRevision")).toMatch(
      /knowledgeRecord[\s\S]*onDelete: Cascade/,
    );
    expect(model("KnowledgeRevisionExternalReference")).toMatch(
      /revision[\s\S]*onDelete: Cascade/,
    );
    expect(migration).toMatch(
      /KnowledgeRecordRevision_record_fkey[\s\S]*ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /KnowledgeExternalReference_revision_fkey[\s\S]*ON DELETE CASCADE/,
    );
  });

  it("uses SetNull for live Mine and Equipment references", () => {
    const revision = model("KnowledgeRecordRevision");
    expect(revision).toMatch(/KnowledgeRevisionMine[\s\S]*onDelete: SetNull/);
    expect(revision).toMatch(
      /KnowledgeRevisionEquipment[\s\S]*onDelete: SetNull/,
    );
    expect(migration).toMatch(
      /KnowledgeRecordRevision_mine_fkey[\s\S]*ON DELETE SET NULL/,
    );
    expect(migration).toMatch(
      /KnowledgeRecordRevision_equipment_fkey[\s\S]*ON DELETE SET NULL/,
    );
  });

  it("owns material content, context snapshots, and review metadata on revisions", () => {
    const revision = model("KnowledgeRecordRevision");
    for (const field of [
      "revisionNumber",
      "origin",
      "contentKind",
      "trust",
      "title",
      "normalizedTitle",
      "bodyMarkdown",
      "safetyCaution",
      "contextKind",
      "mineId",
      "equipmentId",
      "equipmentDisplayNameSnapshot",
      "equipmentNumberSnapshot",
      "equipmentCategorySnapshot",
      "mineNameSnapshot",
      "cityNameSnapshot",
      "cityStateSnapshot",
      "changeSummary",
      "reviewedAt",
    ]) {
      expect(revision).toContain(field);
    }
    expect(revision).not.toMatch(/\bcityId\b/);
  });

  it("defines exact owner-number and external-reference uniqueness", () => {
    expect(model("KnowledgeRecordRevision")).toContain(
      '@@unique([knowledgeRecordId, revisionNumber], map: "KnowledgeRevision_record_number_key")',
    );
    const reference = model("KnowledgeRevisionExternalReference");
    expect(reference).toContain(
      '@@unique([knowledgeRecordRevisionId, sequence], map: "KnowledgeExternalReference_revision_sequence_key")',
    );
    expect(reference).toContain(
      '@@unique([knowledgeRecordRevisionId, normalizedUrl], map: "KnowledgeExternalReference_revision_url_key")',
    );
  });

  it("adds only justified foundation indexes", () => {
    expect(model("KnowledgeRecord")).toContain(
      '@@index([lifecycle, updatedAt, id], map: "KnowledgeRecord_lifecycle_updated_idx")',
    );
    const revision = model("KnowledgeRecordRevision");
    expect(revision).toContain(
      '@@index([normalizedTitle], map: "KnowledgeRevision_normalizedTitle_idx")',
    );
    expect(revision).toContain(
      '@@index([mineId], map: "KnowledgeRevision_mine_idx")',
    );
    expect(revision).toContain(
      '@@index([equipmentId], map: "KnowledgeRevision_equipment_idx")',
    );
    expect(revision).not.toMatch(/@@index\(\[(contentKind|trust)\]/);
    expect(migration).not.toMatch(/\b(?:GIN|GIST|TRGM)\b|to_tsvector/i);
  });

  it("contains every approved manual check-constraint family", () => {
    for (const constraint of [
      "KnowledgeRecord_stateVersion_check",
      "KnowledgeRecord_lifecycle_archivedAt_check",
      "KnowledgeRecord_fingerprint_check",
      "KnowledgeRevision_number_check",
      "KnowledgeRevision_title_check",
      "KnowledgeRevision_normalizedTitle_check",
      "KnowledgeRevision_body_check",
      "KnowledgeRevision_caution_check",
      "KnowledgeRevision_changeSummary_length_check",
      "KnowledgeRevision_trust_reviewedAt_check",
      "KnowledgeRevision_origin_summary_check",
      "KnowledgeRevision_context_shape_check",
      "KnowledgeExternalReference_sequence_check",
      "KnowledgeExternalReference_label_check",
      "KnowledgeExternalReference_url_check",
      "KnowledgeExternalReference_normalizedUrl_check",
    ]) {
      expect(migration).toContain(`CONSTRAINT "${constraint}"`);
    }
    expect(migration).not.toMatch(/btrim\(/);
    expect(migration.match(/~ '\[\^\[:space:\]\]'/g)).toHaveLength(14);
  });

  it("does not add later-slice relationships or unauthorized infrastructure", () => {
    const knowledgeModels = [
      model("KnowledgeRecord"),
      model("KnowledgeRecordRevision"),
      model("KnowledgeRevisionExternalReference"),
    ].join("\n");
    expect(knowledgeModels).not.toMatch(/DailyLog|Defect|DayView|Attachment|Tag|User|Author|Reviewer/);
    expect(migration).not.toMatch(/DailyLog|Defect|DayView|Attachment|Tag|User|Author|Reviewer/);
  });
});
