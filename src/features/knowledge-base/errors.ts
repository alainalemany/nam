export type KnowledgeBaseErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MARKDOWN"
  | "UNSAFE_LINK"
  | "INVALID_CONTEXT"
  | "REFERENCE_NOT_FOUND"
  | "REFERENCE_INACTIVE"
  | "DAILY_LOG_NOT_FOUND"
  | "DEFECT_NOT_FOUND"
  | "INVALID_RELATIONSHIP"
  | "RECORD_NOT_FOUND"
  | "REVISION_NOT_FOUND"
  | "RECORD_NOT_EDITABLE"
  | "RECORD_ALREADY_ARCHIVED"
  | "RECORD_NOT_ARCHIVED"
  | "RESTORE_NOT_AVAILABLE"
  | "DELETE_CONFIRMATION_REQUIRED"
  | "STATE_VERSION_EXHAUSTED"
  | "REVISION_NOT_AVAILABLE"
  | "CHANGE_SUMMARY_REQUIRED"
  | "NO_MATERIAL_CHANGE"
  | "REVISION_NUMBER_EXHAUSTED"
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

export function knowledgeDailyLogNotFoundError() {
  return new KnowledgeBaseError(
    "DAILY_LOG_NOT_FOUND",
    "The selected source Daily Log could not be found.",
    "sourceDailyLogId",
  );
}

export function knowledgeDefectNotFoundError() {
  return new KnowledgeBaseError(
    "DEFECT_NOT_FOUND",
    "The selected related Defect could not be found.",
    "relatedDefectId",
  );
}

export function knowledgeInvalidRelationshipError(message = "Choose a valid relationship state.") {
  return new KnowledgeBaseError("INVALID_RELATIONSHIP", message, "relationships");
}

export function knowledgeNotEditableError() {
  return new KnowledgeBaseError(
    "RECORD_NOT_EDITABLE",
    "This Knowledge Record is read-only in its current state.",
  );
}

export function knowledgeChangeSummaryRequiredError() {
  return new KnowledgeBaseError(
    "CHANGE_SUMMARY_REQUIRED",
    "Describe what changed before creating a new revision.",
    "changeSummary",
  );
}

export function knowledgeNoMaterialChangeError() {
  return new KnowledgeBaseError(
    "NO_MATERIAL_CHANGE",
    "No material change was found. The current revision remains unchanged.",
    "form",
  );
}

export function knowledgeRevisionNumberExhaustedError() {
  return new KnowledgeBaseError(
    "REVISION_NUMBER_EXHAUSTED",
    "This Knowledge Record cannot create another revision safely.",
  );
}

export function knowledgeStateVersionExhaustedError() {
  return new KnowledgeBaseError(
    "STATE_VERSION_EXHAUSTED",
    "This Knowledge Record cannot perform another lifecycle transition safely.",
  );
}

export function knowledgeAlreadyArchivedError() {
  return new KnowledgeBaseError(
    "RECORD_ALREADY_ARCHIVED",
    "This Knowledge Record is already Archived.",
  );
}

export function knowledgeNotArchivedError() {
  return new KnowledgeBaseError(
    "RECORD_NOT_ARCHIVED",
    "This Knowledge Record is not Archived.",
  );
}

export function knowledgeRestoreNotAvailableError() {
  return new KnowledgeBaseError(
    "RESTORE_NOT_AVAILABLE",
    "This Knowledge Record cannot be restored safely.",
  );
}

export function knowledgeDeleteConfirmationError() {
  return new KnowledgeBaseError(
    "DELETE_CONFIRMATION_REQUIRED",
    "Enter the exact current title to confirm permanent deletion.",
    "deleteConfirmation",
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
