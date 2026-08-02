export type KnowledgeBaseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MARKDOWN"
  | "UNSAFE_LINK"
  | "INVALID_CONTEXT"
  | "REFERENCE_NOT_FOUND"
  | "REFERENCE_INACTIVE"
  | "RECORD_NOT_FOUND"
  | "RECORD_NOT_EDITABLE"
  | "CONCURRENT_MODIFICATION"
  | "CURRENT_AUTHORITY_CHANGED"
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

export function knowledgeNotFoundError() {
  return new KnowledgeBaseError(
    "RECORD_NOT_FOUND",
    "The Knowledge Record could not be found.",
  );
}

export function knowledgeNotEditableError() {
  return new KnowledgeBaseError(
    "RECORD_NOT_EDITABLE",
    "This Knowledge Record is read-only in its current state.",
  );
}

export function knowledgeConcurrentModificationError() {
  return new KnowledgeBaseError(
    "CONCURRENT_MODIFICATION",
    "This Knowledge Record changed after the form was loaded. Reload it before trying again.",
  );
}

export function knowledgeCurrentAuthorityChangedError() {
  return new KnowledgeBaseError(
    "CURRENT_AUTHORITY_CHANGED",
    "The current Knowledge Record authority changed. Reload it before trying again.",
  );
}
