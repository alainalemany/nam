import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  createSafetyChecklistResultMarker,
  SafetyChecklistResultMarkerConfigurationError,
  verifySafetyChecklistResultMarker,
} from "@/features/operational-safety-checklists/result-marker";

const secret = "test-result-signing-secret-at-least-32-bytes";
const checklistId = "checklist-1";
const recordVersion = 3;
const now = Date.parse("2026-07-16T12:01:00.000Z");

function manuallySigned(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

describe("Operational Safety Checklist result markers", () => {
  beforeEach(() => {
    process.env.NAM_CHECKLIST_RESULT_SIGNING_SECRET = secret;
  });

  it.each(["created", "corrected"] as const)("verifies a valid %s marker", (outcome) => {
    const marker = createSafetyChecklistResultMarker(outcome, checklistId, recordVersion, now);
    expect(
      verifySafetyChecklistResultMarker(marker, checklistId, recordVersion, now + 1),
    ).toBe(outcome);
  });

  it("rejects malformed, forged, and manually invented markers", () => {
    const valid = createSafetyChecklistResultMarker("created", checklistId, recordVersion, now);
    expect(verifySafetyChecklistResultMarker("created", checklistId, recordVersion, now)).toBeNull();
    expect(verifySafetyChecklistResultMarker("malformed", checklistId, recordVersion, now)).toBeNull();
    expect(
      verifySafetyChecklistResultMarker(`${valid.slice(0, -1)}x`, checklistId, recordVersion, now),
    ).toBeNull();
  });

  it("rejects unsupported outcomes even with a valid signature", () => {
    const marker = manuallySigned({
      version: 2,
      outcome: "submitted-externally",
      checklistId,
      recordVersion,
      issuedAt: now,
      expiresAt: now + 300_000,
    });
    expect(verifySafetyChecklistResultMarker(marker, checklistId, recordVersion, now)).toBeNull();
  });

  it("rejects expired and future-issued markers", () => {
    const expired = createSafetyChecklistResultMarker("created", checklistId, recordVersion, now);
    expect(
      verifySafetyChecklistResultMarker(expired, checklistId, recordVersion, now + 300_001),
    ).toBeNull();

    const future = createSafetyChecklistResultMarker(
      "created",
      checklistId,
      recordVersion,
      now + 31_000,
    );
    expect(verifySafetyChecklistResultMarker(future, checklistId, recordVersion, now)).toBeNull();
  });

  it("rejects wrong checklist and superseded record-version bindings", () => {
    const marker = createSafetyChecklistResultMarker("corrected", checklistId, recordVersion, now);
    expect(
      verifySafetyChecklistResultMarker(marker, "checklist-2", recordVersion, now),
    ).toBeNull();
    expect(
      verifySafetyChecklistResultMarker(
        marker,
        checklistId,
        recordVersion + 1,
        now,
      ),
    ).toBeNull();
    expect(
      verifySafetyChecklistResultMarker(marker, checklistId, recordVersion, now),
    ).toBe("corrected");
  });

  it("fails closed without a sufficiently strong server secret", () => {
    delete process.env.NAM_CHECKLIST_RESULT_SIGNING_SECRET;
    expect(() =>
      createSafetyChecklistResultMarker("created", checklistId, recordVersion, now),
    ).toThrow(SafetyChecklistResultMarkerConfigurationError);
    expect(
      verifySafetyChecklistResultMarker("anything", checklistId, recordVersion, now),
    ).toBeNull();

    process.env.NAM_CHECKLIST_RESULT_SIGNING_SECRET = "too-short";
    expect(() =>
      createSafetyChecklistResultMarker("created", checklistId, recordVersion, now),
    ).toThrow(SafetyChecklistResultMarkerConfigurationError);
    expect(
      verifySafetyChecklistResultMarker("anything", checklistId, recordVersion, now),
    ).toBeNull();
  });
});
