import { supplyRequestLifecycleMaximumAttempts } from "./constants";
import { SupplyRequestDailyLogLinkError } from "./daily-log-link-errors";

const rollbackCertainCodes = new Set(["40001", "40P01"]);

function codeOf(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

export function isRetryableSupplyRequestDailyLogLinkError(error: unknown) {
  const code = codeOf(error);
  if (code === "P2034" || (code && rollbackCertainCodes.has(code))) return true;
  if (code !== "P2010" || !("meta" in (error as object))) return false;
  const meta = (error as { meta?: unknown }).meta;
  return (
    !!meta &&
    typeof meta === "object" &&
    "code" in meta &&
    typeof meta.code === "string" &&
    rollbackCertainCodes.has(meta.code)
  );
}

export async function runSupplyRequestDailyLogLinkWithRetry<T>(
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
      if (!isRetryableSupplyRequestDailyLogLinkError(error)) throw error;
      if (attempt === supplyRequestLifecycleMaximumAttempts) {
        throw new SupplyRequestDailyLogLinkError(
          "RETRY_EXHAUSTED",
          "The Daily Log link could not be updated after a temporary database conflict. Reload and try again.",
        );
      }
    }
  }
  throw new SupplyRequestDailyLogLinkError(
    "UNEXPECTED_PERSISTENCE",
    "The Daily Log link could not be updated in NAM. Reload and try again.",
  );
}
