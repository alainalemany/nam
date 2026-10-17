import { z } from "zod";

const recordId = z.string().trim().min(1).max(191);
const expectedVersion = z.number().int().positive();
const reason = z.string().trim().min(1, "A review reason is required.").max(1000);
const optionalEvidenceReference = z.string().trim().min(1).max(500).optional();
const requiredEvidenceReference = z.string().trim().min(1, "An evidence reference is required.").max(500);
const requestToken = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const common = {
  reason,
  sourceEvidenceReference: optionalEvidenceReference,
  requestToken,
};

export const timesheetIdentityReviewInputSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("VERIFY_OWNER"),
    timesheetId: recordId,
    expectedIdentityVersion: expectedVersion,
    employeeId: recordId,
    ...common,
  }).strict(),
  z.object({
    decision: z.literal("REVIEW_UNASSIGNED"),
    timesheetId: recordId,
    expectedIdentityVersion: expectedVersion,
    ...common,
  }).strict(),
  z.object({
    decision: z.literal("REOPEN_UNCERTAINTY"),
    timesheetId: recordId,
    expectedIdentityVersion: expectedVersion,
    ...common,
  }).strict(),
  z.object({
    decision: z.literal("CORRECT_OWNER"),
    timesheetId: recordId,
    expectedIdentityVersion: expectedVersion,
    employeeId: recordId,
    ...common,
  }).strict(),
]);

const rateCommon = {
  rateId: recordId,
  expectedEvidenceVersion: expectedVersion,
  reason,
  requestToken,
};

export const payRateEvidenceReviewInputSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("VERIFY_PAYCHECK"),
    ...rateCommon,
    sourcePaycheckId: recordId,
    sourceEvidenceReference: optionalEvidenceReference,
  }).strict(),
  z.object({
    decision: z.literal("VERIFY_INDEPENDENT"),
    ...rateCommon,
    sourceEvidenceReference: requiredEvidenceReference,
  }).strict(),
  z.object({
    decision: z.literal("MARK_CONFLICT"),
    ...rateCommon,
    sourceEvidenceReference: optionalEvidenceReference,
  }).strict(),
  z.object({
    decision: z.literal("EXCLUDE"),
    ...rateCommon,
    sourceEvidenceReference: optionalEvidenceReference,
  }).strict(),
  z.object({
    decision: z.literal("REOPEN_REVIEW"),
    ...rateCommon,
    sourceEvidenceReference: optionalEvidenceReference,
  }).strict(),
]);

const competitorDispositionSchema = z.object({
  rateId: recordId,
  expectedEvidenceVersion: expectedVersion,
  disposition: z.enum(["CONFLICT", "EXCLUDED", "SUPERSEDED"]),
}).strict();

export const payRateEvidenceResolutionInputSchema = z.object({
  decision: z.literal("RESOLVE_COMPETITORS"),
  selectedRateId: recordId,
  selectedExpectedEvidenceVersion: expectedVersion,
  selectedProvenance: z.enum(["PAYCHECK", "INDEPENDENT"]),
  sourcePaycheckId: recordId.optional(),
  competitors: z.array(competitorDispositionSchema).min(1),
  reason,
  sourceEvidenceReference: optionalEvidenceReference,
  requestToken,
}).strict().superRefine((value, context) => {
  if (value.selectedProvenance === "PAYCHECK" && !value.sourcePaycheckId) {
    context.addIssue({ code: "custom", path: ["sourcePaycheckId"], message: "Select a supporting Paycheck." });
  }
  if (value.selectedProvenance === "INDEPENDENT" && !value.sourceEvidenceReference) {
    context.addIssue({ code: "custom", path: ["sourceEvidenceReference"], message: "An evidence reference is required." });
  }
  const ids = [value.selectedRateId, ...value.competitors.map((item) => item.rateId)];
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["competitors"], message: "Each rate may appear only once." });
  }
});

export const payRateBoundaryVerificationInputSchema = z.object({
  decision: z.literal("VERIFY_EXACT_BOUNDARY"),
  candidateId: recordId,
  expectedEvidenceVersion: expectedVersion,
  exactEffectiveDate: dateOnly,
  reason,
  sourceEvidenceReference: optionalEvidenceReference,
  requestToken,
}).strict();

export const payRateBoundaryRejectionInputSchema = z.object({
  decision: z.literal("REJECT_BOUNDARY_CANDIDATE"),
  candidateId: recordId,
  expectedEvidenceVersion: expectedVersion,
  reason,
  sourceEvidenceReference: optionalEvidenceReference,
  requestToken,
}).strict();

export type TimesheetIdentityReviewInput = z.infer<typeof timesheetIdentityReviewInputSchema>;
export type PayRateEvidenceReviewInput = z.infer<typeof payRateEvidenceReviewInputSchema>;
export type PayRateEvidenceResolutionInput = z.infer<typeof payRateEvidenceResolutionInputSchema>;
export type PayRateBoundaryVerificationInput = z.infer<typeof payRateBoundaryVerificationInputSchema>;
export type PayRateBoundaryRejectionInput = z.infer<typeof payRateBoundaryRejectionInputSchema>;
