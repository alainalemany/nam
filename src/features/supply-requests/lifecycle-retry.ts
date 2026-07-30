import { supplyRequestLifecycleMaximumAttempts } from "./constants";
import { SupplyRequestLifecycleError } from "./lifecycle-errors";

const rollbackOnlyPostgresCodes = new Set(["40001", "40P01"]);

function codeOf(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function metaOf(error: unknown) {
  if (!error || typeof error !== "object" || !("meta" in error)) return null;
  return error.meta && typeof error.meta === "object"
    ? (error.meta as Record<string, unknown>)
    : null;
}

export function isRetryableSupplyRequestLifecycleError(error: unknown) {
  const code = codeOf(error);
  if (code === "P2034" || (code && rollbackOnlyPostgresCodes.has(code))) {
    return true;
  }
  const meta = metaOf(error);
  return (
    code === "P2010" &&
    typeof meta?.code === "string" &&
    rollbackOnlyPostgresCodes.has(meta.code)
  );
}

export async function runSupplyRequestLifecycleWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
) {
  for (
    let attempt = 1;
    attempt <= supplyRequestLifecycleMaximumAttempts;
    attempt += 1
  ) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isRetryableSupplyRequestLifecycleError(error)) throw error;
      if (attempt === supplyRequestLifecycleMaximumAttempts) {
        throw new SupplyRequestLifecycleError(
          "RETRY_EXHAUSTED",
          "The Supply Request could not be updated in NAM after a temporary database conflict. Reload and try again.",
        );
      }
    }
  }

  throw new SupplyRequestLifecycleError(
    "UNEXPECTED_PERSISTENCE",
    "The Supply Request could not be updated in NAM. Try again.",
  );
}
