"use server";

import { revalidatePath } from "next/cache";

import {
  PayrollAccessConfigurationError,
  PayrollAccessDeniedError,
  requirePayrollEvidenceReviewer,
} from "./auth";
import {
  resolvePayRateEvidenceCompetitors,
  reviewPayRateEvidence,
  reviewTimesheetIdentity,
} from "./evidence-review-persistence";
import {
  rejectPayRateBoundaryCandidate,
  verifyExactPayRateBoundary,
} from "./rate-boundary-persistence";
import {
  EvidenceReviewError,
  type EvidenceReviewFailure,
  type EvidenceReviewResult,
} from "./evidence-review-types";
import {
  payRateEvidenceResolutionInputSchema,
  payRateEvidenceReviewInputSchema,
  payRateBoundaryRejectionInputSchema,
  payRateBoundaryVerificationInputSchema,
  timesheetIdentityReviewInputSchema,
} from "./evidence-review-validation";

function failure(
  code: EvidenceReviewFailure["code"],
  message: string,
  fieldErrors?: Record<string, string[]>,
): EvidenceReviewFailure {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function parsePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string" || raw.length > 50_000) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function validationFailure(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  const evidenceReferenceIssue = issues.some((issue) => issue.path[0] === "sourceEvidenceReference");
  return failure(
    evidenceReferenceIssue ? "INVALID_EVIDENCE_REFERENCE" : "INVALID_TRANSITION",
    "Review data is invalid. Check the submitted fields and try again.",
    fieldErrors,
  );
}

function actionFailure(error: unknown): EvidenceReviewFailure {
  if (error instanceof PayrollAccessConfigurationError || error instanceof PayrollAccessDeniedError) {
    return failure("UNAUTHORIZED_REVIEW", "Payroll evidence review access denied.");
  }
  if (error instanceof EvidenceReviewError) return failure(error.code, error.message);
  return failure("INVALID_TRANSITION", "The review decision could not be saved. No evidence was changed.");
}

function revalidateTimesheetReview(id: string) {
  revalidatePath("/");
  revalidatePath("/payroll");
  revalidatePath("/payroll/evidence-review");
  revalidatePath(`/payroll/evidence-review/timesheets/${id}`);
  revalidatePath(`/timesheets/${id}`);
}

function revalidateRateReview(id: string) {
  revalidatePath("/");
  revalidatePath("/payroll");
  revalidatePath("/payroll/evidence-review");
  revalidatePath(`/payroll/evidence-review/rates/${id}`);
}

export async function reviewTimesheetIdentityAction(
  _previousState: EvidenceReviewResult,
  formData: FormData,
): Promise<EvidenceReviewResult> {
  try {
    const reviewer = await requirePayrollEvidenceReviewer();
    const parsed = timesheetIdentityReviewInputSchema.safeParse(parsePayload(formData));
    if (!parsed.success) return validationFailure(parsed.error.issues);
    const result = await reviewTimesheetIdentity(reviewer, parsed.data);
    revalidateTimesheetReview(result.targetId);
    return result;
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reviewPayRateEvidenceAction(
  _previousState: EvidenceReviewResult,
  formData: FormData,
): Promise<EvidenceReviewResult> {
  try {
    const reviewer = await requirePayrollEvidenceReviewer();
    const parsed = payRateEvidenceReviewInputSchema.safeParse(parsePayload(formData));
    if (!parsed.success) return validationFailure(parsed.error.issues);
    const result = await reviewPayRateEvidence(reviewer, parsed.data);
    revalidateRateReview(result.targetId);
    return result;
  } catch (error) {
    return actionFailure(error);
  }
}

export async function resolvePayRateEvidenceCompetitorsAction(
  _previousState: EvidenceReviewResult,
  formData: FormData,
): Promise<EvidenceReviewResult> {
  try {
    const reviewer = await requirePayrollEvidenceReviewer();
    const parsed = payRateEvidenceResolutionInputSchema.safeParse(parsePayload(formData));
    if (!parsed.success) return validationFailure(parsed.error.issues);
    const result = await resolvePayRateEvidenceCompetitors(reviewer, parsed.data);
    revalidateRateReview(result.targetId);
    return result;
  } catch (error) {
    return actionFailure(error);
  }
}

export async function verifyExactPayRateBoundaryAction(
  _previousState: EvidenceReviewResult,
  formData: FormData,
): Promise<EvidenceReviewResult> {
  try {
    const reviewer = await requirePayrollEvidenceReviewer();
    const parsed = payRateBoundaryVerificationInputSchema.safeParse(parsePayload(formData));
    if (!parsed.success) return validationFailure(parsed.error.issues);
    const result = await verifyExactPayRateBoundary(reviewer, parsed.data);
    revalidateRateReview(result.targetId);
    return result;
  } catch (error) {
    return actionFailure(error);
  }
}

export async function rejectPayRateBoundaryCandidateAction(
  _previousState: EvidenceReviewResult,
  formData: FormData,
): Promise<EvidenceReviewResult> {
  try {
    const reviewer = await requirePayrollEvidenceReviewer();
    const parsed = payRateBoundaryRejectionInputSchema.safeParse(parsePayload(formData));
    if (!parsed.success) return validationFailure(parsed.error.issues);
    const result = await rejectPayRateBoundaryCandidate(reviewer, parsed.data);
    revalidateRateReview(result.targetId);
    return result;
  } catch (error) {
    return actionFailure(error);
  }
}
