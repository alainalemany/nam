import { z } from "zod";

import {
  supplyRequestMaximumIdentifierLength,
  supplyRequestMaximumLifecycleNarrativeLength,
} from "./constants";
import { SupplyRequestLifecycleError } from "./lifecycle-errors";
import { isCanonicalSupplyRequestDate } from "./validation";

const signedPostgresIntMaximum = 2_147_483_647;

const requestIdSchema = z
  .string({ message: "Supply Request is required." })
  .trim()
  .min(1, "Supply Request is required.")
  .max(
    supplyRequestMaximumIdentifierLength,
    `Supply Request ID must be ${supplyRequestMaximumIdentifierLength} characters or fewer.`,
  );

const expectedVersionSchema = z
  .number({ message: "Expected current version must be a number." })
  .int("Expected current version must be a whole number.")
  .safe("Expected current version must be a safe whole number.")
  .min(1, "Expected current version must be at least 1.")
  .max(
    signedPostgresIntMaximum,
    "Expected current version is outside the supported range.",
  );

const optionalNarrative = (label: string) =>
  z
    .string({ message: `${label} must be text.` })
    .trim()
    .max(
      supplyRequestMaximumLifecycleNarrativeLength,
      `${label} must be ${supplyRequestMaximumLifecycleNarrativeLength} characters or fewer.`,
    )
    .optional()
    .transform((value) => value || undefined);

export const fulfillSupplyRequestInputSchema = z
  .object({
    supplyRequestId: requestIdSchema,
    expectedCurrentVersionNumber: expectedVersionSchema,
    fulfillmentOperationalWorkDate: z
      .string({ message: "Fulfillment operational work date is required." })
      .refine(
        isCanonicalSupplyRequestDate,
        "Enter a real fulfillment operational work date in YYYY-MM-DD format.",
      ),
    fulfillmentNote: optionalNarrative("Fulfillment Note"),
  })
  .strict();

export const cancelSupplyRequestInputSchema = z
  .object({
    supplyRequestId: requestIdSchema,
    expectedCurrentVersionNumber: expectedVersionSchema,
    cancellationReason: optionalNarrative("Cancellation Reason"),
  })
  .strict();

export type FulfillSupplyRequestInput = z.input<
  typeof fulfillSupplyRequestInputSchema
>;
export type ValidatedFulfillSupplyRequestInput = z.output<
  typeof fulfillSupplyRequestInputSchema
>;
export type CancelSupplyRequestInput = z.input<
  typeof cancelSupplyRequestInputSchema
>;
export type ValidatedCancelSupplyRequestInput = z.output<
  typeof cancelSupplyRequestInputSchema
>;

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

function invalidLifecycleInput(error: z.ZodError): never {
  throw new SupplyRequestLifecycleError(
    "INVALID_INPUT",
    "Check the lifecycle details before updating this Supply Request in NAM.",
    undefined,
    fieldErrors(error),
  );
}

export function parseFulfillSupplyRequestInput(
  input: FulfillSupplyRequestInput,
) {
  const parsed = fulfillSupplyRequestInputSchema.safeParse(input);
  if (!parsed.success) invalidLifecycleInput(parsed.error);
  return parsed.data;
}

export function parseCancelSupplyRequestInput(
  input: CancelSupplyRequestInput,
) {
  const parsed = cancelSupplyRequestInputSchema.safeParse(input);
  if (!parsed.success) invalidLifecycleInput(parsed.error);
  return parsed.data;
}

export function isLifecycleWallClockBeforeSubmission(
  lifecycleDate: string,
  lifecycleTime: string,
  submittedDate: string,
  submittedTime: string,
) {
  return `${lifecycleDate}T${lifecycleTime}` < `${submittedDate}T${submittedTime}`;
}
