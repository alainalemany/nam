import { knowledgeCreateMaximumAttempts } from "./constants";

const rollbackCertainPostgresCodes = new Set(["40001", "40P01"]);

function code(error: unknown) {
  return error && typeof error === "object" && "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

function metadata(error: unknown) {
  return error && typeof error === "object" && "meta" in error &&
    error.meta && typeof error.meta === "object"
    ? (error.meta as Record<string, unknown>)
    : undefined;
}

export function isRetryableKnowledgeCreateError(error: unknown) {
  const errorCode = code(error);
  if (errorCode === "P2034" || (errorCode && rollbackCertainPostgresCodes.has(errorCode))) {
    return true;
  }
  const meta = metadata(error);
  return (
    errorCode === "P2010" &&
    typeof meta?.code === "string" &&
    rollbackCertainPostgresCodes.has(meta.code)
  );
}

export function isKnowledgeSubmissionKeyUniqueError(error: unknown) {
  if (code(error) !== "P2002") return false;
  const target = metadata(error)?.target;
  return (
    target === "KnowledgeRecord_submissionKey_key" ||
    (Array.isArray(target) &&
      target.length === 1 &&
      target[0] === "createSubmissionKey")
  );
}

export async function runKnowledgeCreateWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= knowledgeCreateMaximumAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (!isRetryableKnowledgeCreateError(error) || attempt === knowledgeCreateMaximumAttempts) {
        throw error;
      }
    }
  }
  throw lastError;
}
