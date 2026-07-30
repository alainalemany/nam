import { z } from "zod";

import {
  normalizeSupervisorEmail,
  normalizeSupervisorFullName,
  normalizeSupplyItemNumberDisplay,
  normalizeSupplyItemNumberKey,
  normalizeSupplyRequestDisplayText,
  SupplyRequestNormalizationError,
} from "./normalization";
import { SupplyRequestReferenceError } from "./reference-errors";

const referenceIdSchema = z.string().trim().min(1).max(100);

function normalizedDisplayField(label: string, maximum: number) {
  return z
    .string({ message: `${label} is required.` })
    .transform(normalizeSupplyRequestDisplayText)
    .pipe(
      z
        .string()
        .min(1, `${label} is required.`)
        .max(maximum, `${label} must be ${maximum} characters or fewer.`),
    );
}

const supplyItemInputSchema = z
  .object({
    itemNumber: z
      .string({ message: "Item Number is required." })
      .transform(normalizeSupplyItemNumberDisplay)
      .pipe(
        z
          .string()
          .min(1, "Item Number is required.")
          .max(100, "Item Number must be 100 characters or fewer."),
      ),
    description: normalizedDisplayField("Description", 500),
    unitOfMeasure: normalizedDisplayField("Unit", 100),
  })
  .strict()
  .transform((value) => ({
    ...value,
    normalizedItemNumber: normalizeSupplyItemNumberKey(value.itemNumber),
  }));

const supervisorInputSchema = z
  .object({
    fullName: z
      .string({ message: "Full name is required." })
      .transform(normalizeSupervisorFullName)
      .pipe(
        z
          .string()
          .min(1, "Full name is required.")
          .max(200, "Full name must be 200 characters or fewer."),
      ),
    email: z.string({ message: "Email is required." }).transform((value, context) => {
      try {
        return normalizeSupervisorEmail(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof SupplyRequestNormalizationError
              ? error.message
              : "Enter a valid supervisor email address.",
        });
        return z.NEVER;
      }
    }),
  })
  .strict()
  .transform((value) => ({
    fullName: value.fullName,
    email: value.email.displayEmail,
    normalizedEmail: value.email.normalizedEmail,
  }));

const statusIntentSchema = z.enum(["activate", "inactivate"]);

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}

function invalidInput(error: z.ZodError): never {
  throw new SupplyRequestReferenceError(
    "INVALID_INPUT",
    "Check the reference details before saving.",
    undefined,
    fieldErrors(error),
  );
}

export type SupplyItemReferenceInput = z.output<typeof supplyItemInputSchema>;
export type SupervisorReferenceInput = z.output<typeof supervisorInputSchema>;
export type ReferenceStatusIntent = z.output<typeof statusIntentSchema>;

export function parseSupplyItemReferenceInput(
  input: unknown,
): SupplyItemReferenceInput {
  const parsed = supplyItemInputSchema.safeParse(input);
  if (!parsed.success) invalidInput(parsed.error);
  return parsed.data;
}

export function parseSupervisorReferenceInput(
  input: unknown,
): SupervisorReferenceInput {
  const parsed = supervisorInputSchema.safeParse(input);
  if (!parsed.success) invalidInput(parsed.error);
  return parsed.data;
}

export function parseReferenceId(input: unknown) {
  const parsed = referenceIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new SupplyRequestReferenceError(
      "NOT_FOUND",
      "The requested reference record could not be found.",
    );
  }
  return parsed.data;
}

export function normalizeReferenceIdForLookup(input: unknown) {
  const parsed = referenceIdSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseReferenceStatusIntent(
  input: unknown,
): ReferenceStatusIntent {
  const parsed = statusIntentSchema.safeParse(input);
  if (!parsed.success) {
    throw new SupplyRequestReferenceError(
      "INVALID_INPUT",
      "Choose Activate or Inactivate.",
      "status",
    );
  }
  return parsed.data;
}
