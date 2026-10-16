export type EvidenceReviewErrorCode =
  | "STALE_REVIEW"
  | "IDENTITY_CONFLICT"
  | "RATE_EVIDENCE_CONFLICT"
  | "INVALID_TRANSITION"
  | "UNAUTHORIZED_REVIEW"
  | "EVIDENCE_NOT_FOUND"
  | "INVALID_IDEMPOTENCY_TOKEN"
  | "INVALID_EVIDENCE_REFERENCE";

export type EvidenceReviewSuccess = {
  ok: true;
  targetId: string;
  newState: string;
  newVersion: number;
  auditEventId: string;
  idempotencyReplay: boolean;
};

export type EvidenceReviewFailure = {
  ok: false;
  code: EvidenceReviewErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type EvidenceReviewResult = EvidenceReviewSuccess | EvidenceReviewFailure;

export type EvidenceReviewerActor = {
  employeeId: string;
  displayName: string;
  employeeCode: string | null;
};

export class EvidenceReviewError extends Error {
  constructor(readonly code: EvidenceReviewErrorCode, message: string) {
    super(message);
  }
}
