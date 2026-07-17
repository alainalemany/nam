import { createHmac, timingSafeEqual } from "node:crypto";

export const safetyChecklistResultMarkerEnvironmentVariable =
  "NAM_CHECKLIST_RESULT_SIGNING_SECRET";

export const safetyChecklistResultOutcomes = ["created", "corrected"] as const;

export type SafetyChecklistResultOutcome =
  (typeof safetyChecklistResultOutcomes)[number];

type SafetyChecklistResultPayload = {
  version: 2;
  outcome: SafetyChecklistResultOutcome;
  checklistId: string;
  recordVersion: number;
  issuedAt: number;
  expiresAt: number;
};

const markerLifetimeMs = 5 * 60 * 1000;
const futureClockSkewMs = 30 * 1000;
const minimumSecretBytes = 32;

export class SafetyChecklistResultMarkerConfigurationError extends Error {
  constructor() {
    super("Checklist result marker signing is unavailable.");
  }
}

function signingSecret() {
  const secret = process.env[safetyChecklistResultMarkerEnvironmentVariable];
  if (!secret || Buffer.byteLength(secret, "utf8") < minimumSecretBytes) {
    throw new SafetyChecklistResultMarkerConfigurationError();
  }
  return secret;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isOutcome(value: unknown): value is SafetyChecklistResultOutcome {
  return safetyChecklistResultOutcomes.includes(
    value as SafetyChecklistResultOutcome,
  );
}

function parsePayload(value: string): SafetyChecklistResultPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      parsed?.version !== 2 ||
      !isOutcome(parsed.outcome) ||
      typeof parsed.checklistId !== "string" ||
      parsed.checklistId.length < 1 ||
      parsed.checklistId.length > 120 ||
      typeof parsed.recordVersion !== "number" ||
      !Number.isInteger(parsed.recordVersion) ||
      parsed.recordVersion < 1 ||
      typeof parsed.issuedAt !== "number" ||
      !Number.isInteger(parsed.issuedAt) ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isInteger(parsed.expiresAt)
    ) {
      return null;
    }
    return parsed as SafetyChecklistResultPayload;
  } catch {
    return null;
  }
}

export function createSafetyChecklistResultMarker(
  outcome: SafetyChecklistResultOutcome,
  checklistId: string,
  recordVersion: number,
  now = Date.now(),
) {
  const payload: SafetyChecklistResultPayload = {
    version: 2,
    outcome,
    checklistId,
    recordVersion,
    issuedAt: now,
    expiresAt: now + markerLifetimeMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${signature(encoded, signingSecret())}`;
}

export function verifySafetyChecklistResultMarker(
  marker: string | undefined,
  checklistId: string,
  recordVersion: number,
  now = Date.now(),
): SafetyChecklistResultOutcome | null {
  if (!marker || marker.length > 2048) return null;
  const parts = marker.split(".");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[1])
  ) {
    return null;
  }

  let secret: string;
  try {
    secret = signingSecret();
  } catch {
    return null;
  }

  const expected = Buffer.from(signature(parts[0], secret), "utf8");
  const submitted = Buffer.from(parts[1], "utf8");
  if (
    expected.length !== submitted.length ||
    !timingSafeEqual(expected, submitted)
  ) {
    return null;
  }

  const payload = parsePayload(parts[0]);
  if (
    !payload ||
    payload.checklistId !== checklistId ||
    payload.recordVersion !== recordVersion ||
    payload.issuedAt > now + futureClockSkewMs ||
    payload.expiresAt <= now ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > markerLifetimeMs
  ) {
    return null;
  }
  return payload.outcome;
}
