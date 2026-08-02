import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalKnowledgeCreatePayload,
  fingerprintKnowledgeCreatePayload,
  serializeCanonicalKnowledgeCreatePayload,
} from "@/features/knowledge-base/fingerprint";
import type { KnowledgeCreateInput } from "@/features/knowledge-base/types";

const input: KnowledgeCreateInput = {
  submissionKey: randomUUID(),
  contentKind: "PROCEDURE",
  title: "Startup",
  bodyMarkdown: "## Steps\n\n1. Inspect",
  safetyCaution: null,
  contextKind: "MINE",
  mineId: "mine-1",
  equipmentId: null,
  sourceDailyLogId: null,
  relatedDefectId: null,
  externalReferences: [
    { label: "Manual", url: "https://example.com/manual" },
    { label: "Policy", url: "https://example.com/policy" },
  ],
};
const context = {
  kind: "MINE" as const,
  mineId: "mine-1",
  mineName: "North Mine",
  cityName: "Gillette",
  cityState: "WY",
};

describe("Knowledge Base canonical create fingerprint", () => {
  it("uses deterministic versioned canonical serialization and SHA-256", () => {
    const payload = canonicalKnowledgeCreatePayload(input, context);
    const serialized = serializeCanonicalKnowledgeCreatePayload(payload);
    expect(serialized).toBe(JSON.stringify(payload));
    expect(serialized).toContain('"formatVersion":"nam.knowledge-base.create.v2"');
    expect(fingerprintKnowledgeCreatePayload(input, context)).toMatch(/^[0-9a-f]{64}$/u);
    expect(fingerprintKnowledgeCreatePayload(input, context)).toBe(
      fingerprintKnowledgeCreatePayload({ ...input }, { ...context }),
    );
  });

  it("includes all material fields and order while excluding generated identity", () => {
    const baseline = fingerprintKnowledgeCreatePayload(input, context);
    expect(fingerprintKnowledgeCreatePayload({ ...input, submissionKey: randomUUID() }, context)).toBe(baseline);
    expect(fingerprintKnowledgeCreatePayload({ ...input, title: "Shutdown" }, context)).not.toBe(baseline);
    expect(fingerprintKnowledgeCreatePayload({ ...input, externalReferences: [...input.externalReferences].reverse() }, context)).not.toBe(baseline);
    expect(fingerprintKnowledgeCreatePayload(input, { ...context, mineName: "Renamed Mine" })).not.toBe(baseline);
    const serialized = serializeCanonicalKnowledgeCreatePayload(canonicalKnowledgeCreatePayload(input, context));
    expect(serialized).not.toContain(input.submissionKey);
    expect(serialized).not.toContain("stateVersion");
    expect(serialized).not.toContain("createdAt");
  });

  it("distinguishes absent values from present values", () => {
    expect(fingerprintKnowledgeCreatePayload(input, context)).not.toBe(
      fingerprintKnowledgeCreatePayload({ ...input, safetyCaution: "" }, context),
    );
  });

  it("fingerprints selected relationship identity without mutable owner snapshots", () => {
    const selected = {
      ...input,
      sourceDailyLogId: "daily-log-stable-id",
      relatedDefectId: "defect-stable-id",
    };
    const baseline = fingerprintKnowledgeCreatePayload(selected, context);
    expect(baseline).not.toBe(fingerprintKnowledgeCreatePayload(input, context));
    expect(fingerprintKnowledgeCreatePayload({
      ...selected,
      relatedDefectId: "different-defect-id",
    }, context)).not.toBe(baseline);
    expect(canonicalKnowledgeCreatePayload(selected, context).relationships).toEqual({
      sourceDailyLogId: "daily-log-stable-id",
      relatedDefectId: "defect-stable-id",
    });
  });
});
