export type KnowledgeBaseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MARKDOWN"
  | "UNSAFE_LINK"
  | "INVALID_CONTEXT"
  | "REFERENCE_NOT_FOUND"
  | "REFERENCE_INACTIVE"
  | "DUPLICATE_SUBMISSION_CONFLICT"
  | "PERSISTED_STATE_INTEGRITY_FAILURE"
  | "PERSISTENCE_FAILURE";

export class KnowledgeBaseError extends Error {
  readonly name = "KnowledgeBaseError";

  constructor(
    public readonly code: KnowledgeBaseErrorCode,
    message: string,
    public readonly field?: string,
    public readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

export function knowledgePersistenceError() {
  return new KnowledgeBaseError(
    "PERSISTENCE_FAILURE",
    "The Knowledge Record could not be saved. Try again.",
  );
}

export function knowledgeIntegrityError() {
  return new KnowledgeBaseError(
    "PERSISTED_STATE_INTEGRITY_FAILURE",
    "The Knowledge Record could not be loaded safely.",
  );
}
