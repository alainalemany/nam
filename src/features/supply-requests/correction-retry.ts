import { supplyRequestCorrectionMaximumAttempts } from "./constants";
import { SupplyRequestCorrectionError } from "./correction-errors";
import { isRetryableSupplyRequestLifecycleError } from "./lifecycle-retry";

export async function runSupplyRequestCorrectionWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
) {
  for (
    let attempt = 1;
    attempt <= supplyRequestCorrectionMaximumAttempts;
    attempt += 1
  ) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (!isRetryableSupplyRequestLifecycleError(error)) throw error;
      if (attempt === supplyRequestCorrectionMaximumAttempts) {
        throw new SupplyRequestCorrectionError(
          "RETRY_EXHAUSTED",
          "The Supply Request could not be corrected in NAM after a temporary database conflict. Reload and try again.",
        );
      }
    }
  }
  throw new SupplyRequestCorrectionError(
    "UNEXPECTED_PERSISTENCE",
    "The Supply Request could not be corrected in NAM. Try again.",
  );
}
