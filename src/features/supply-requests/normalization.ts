import { z } from "zod";

const supervisorEmailSchema = z
  .string()
  .email("Enter a valid supervisor email address.")
  .max(320, "Supervisor email must be 320 characters or fewer.");

export class SupplyRequestNormalizationError extends Error {
  readonly name = "SupplyRequestNormalizationError";
}

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeSupplyRequestDisplayText(value: string) {
  return collapseWhitespace(value);
}

export function normalizeSupplyItemNumberDisplay(value: string) {
  return normalizeSupplyRequestDisplayText(value);
}

export function normalizeSupplyItemNumberKey(value: string) {
  // String case conversion without a locale argument is deterministic and does
  // not depend on browser locale; punctuation remains unchanged.
  return normalizeSupplyItemNumberDisplay(value).toUpperCase();
}

export function normalizeSupervisorFullName(value: string) {
  return normalizeSupplyRequestDisplayText(value);
}

export function normalizeSupervisorEmail(value: string) {
  const displayEmail = value.trim();
  if (/\s/u.test(displayEmail)) {
    throw new SupplyRequestNormalizationError(
      "Supervisor email must not contain whitespace.",
    );
  }

  const parsed = supervisorEmailSchema.safeParse(displayEmail);
  if (!parsed.success) {
    throw new SupplyRequestNormalizationError(parsed.error.issues[0].message);
  }

  return {
    displayEmail,
    // This comparison key is deliberately locale-independent and bounded to
    // the validated address; V1 does not introduce internationalized-email
    // infrastructure.
    normalizedEmail: displayEmail.toLowerCase(),
  };
}
