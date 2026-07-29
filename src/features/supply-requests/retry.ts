import { supplyRequestCreateMaximumAttempts } from "./constants";
import {
  SupplyRequestCreateError,
  unexpectedSupplyRequestPersistenceError,
} from "./errors";

const transientPostgresCodes = new Set(["40001", "40P01"]);
const retryableReferenceConstraintNames = new Set([
  "SupplyRequest_namReference_key",
  "SupplyRequest_year_sequence_key",
]);

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

function metadata(error: unknown) {
  if (!error || typeof error !== "object" || !("meta" in error)) {
    return undefined;
  }
  return error.meta && typeof error.meta === "object"
    ? (error.meta as Record<string, unknown>)
    : undefined;
}

function isExactRetryableReferenceTarget(target: unknown) {
  if (typeof target === "string") {
    return retryableReferenceConstraintNames.has(target);
  }
  if (!Array.isArray(target) || !target.every((value) => typeof value === "string")) {
    return false;
  }
  return (
    (target.length === 1 && target[0] === "namReference") ||
    (target.length === 2 &&
      target[0] === "referenceYear" &&
      target[1] === "referenceSequence")
  );
}

export function isRetryableSupplyRequestPersistenceError(error: unknown) {
  const code = errorCode(error);
  // These transaction-conflict signals are known rollback outcomes. Connection
  // failures, timeouts, and other ambiguous commit outcomes are intentionally
  // excluded so one logical create cannot be retried after an unknown commit.
  if (code === "P2034" || (code && transientPostgresCodes.has(code))) {
    return true;
  }

  const meta = metadata(error);
  if (
    code === "P2010" &&
    typeof meta?.code === "string" &&
    transientPostgresCodes.has(meta.code)
  ) {
    return true;
  }

  if (code !== "P2002") return false;
  return isExactRetryableReferenceTarget(meta?.target);
}

export async function runSupplyRequestCreateWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
) {
  for (let attempt = 1; attempt <= supplyRequestCreateMaximumAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isRetryableSupplyRequestPersistenceError(error)) throw error;
      if (attempt === supplyRequestCreateMaximumAttempts) {
        throw new SupplyRequestCreateError(
          "RETRY_EXHAUSTED",
          "The request could not be recorded in NAM after a temporary database conflict. Try again.",
        );
      }
    }
  }

  throw unexpectedSupplyRequestPersistenceError();
}
