import { z } from "zod";

import {
  supplyRequestMaximumIdentifierLength,
  supplyRequestMaximumItemCount,
  supplyRequestMaximumNotesLength,
  supplyRequestMaximumQuantity,
} from "./constants";
import { SupplyRequestCreateError } from "./errors";

const canonicalDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const canonicalLocalTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isCanonicalSupplyRequestDate(value: string) {
  if (!canonicalDatePattern.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isCanonicalSupplyRequestLocalTime(value: string) {
  return canonicalLocalTimePattern.test(value);
}

const identifier = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(
      supplyRequestMaximumIdentifierLength,
      `${label} must be ${supplyRequestMaximumIdentifierLength} characters or fewer.`,
    );

const quantity = z
  .number({ message: "Quantity must be a whole number." })
  .refine(Number.isSafeInteger, "Quantity must be a safe whole number.")
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(
    supplyRequestMaximumQuantity,
    `Quantity must be ${supplyRequestMaximumQuantity} or fewer.`,
  );

export const createSupplyRequestInputSchema = z
  .object({
    operationalWorkDate: z
      .string()
      .refine(
        isCanonicalSupplyRequestDate,
        "Enter a real operational work date in YYYY-MM-DD format.",
      ),
    submittedLocalDate: z
      .string()
      .refine(
        isCanonicalSupplyRequestDate,
        "Enter a real submitted local date in YYYY-MM-DD format.",
      ),
    submittedLocalTime: z
      .string()
      .refine(
        isCanonicalSupplyRequestLocalTime,
        "Enter a submitted local time in HH:mm format.",
      ),
    equipmentId: identifier("Equipment"),
    supervisorId: identifier("Supervisor"),
    notes: z
      .string()
      .trim()
      .max(
        supplyRequestMaximumNotesLength,
        `Notes must be ${supplyRequestMaximumNotesLength} characters or fewer.`,
      )
      .nullish()
      .transform((value) => value || undefined),
    corporateSubmissionConfirmed: z
      .boolean({
        message:
          "Confirm that the request was successfully submitted through the corporate system.",
      })
      .refine(
        (value) => value,
        "Confirm that the request was successfully submitted through the corporate system.",
      ),
    items: z
      .array(
        z
          .object({
            supplyItemId: identifier("Supply Item"),
            quantity,
          })
          .strict(),
      )
      .min(1, "Add at least one Supply Item.")
      .max(
        supplyRequestMaximumItemCount,
        `A Supply Request may contain at most ${supplyRequestMaximumItemCount} items.`,
      ),
  })
  .strict();

export type CreateSupplyRequestInput = z.input<
  typeof createSupplyRequestInputSchema
>;
export type ValidatedCreateSupplyRequestInput = z.output<
  typeof createSupplyRequestInputSchema
>;

function validationFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function parseCreateSupplyRequestInput(
  input: CreateSupplyRequestInput,
): ValidatedCreateSupplyRequestInput {
  const parsed = createSupplyRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new SupplyRequestCreateError(
      "INVALID_INPUT",
      "Check the Supply Request details before recording it in NAM.",
      undefined,
      validationFieldErrors(parsed.error),
    );
  }

  const selected = new Set<string>();
  for (const item of parsed.data.items) {
    if (selected.has(item.supplyItemId)) {
      throw new SupplyRequestCreateError(
        "DUPLICATE_ITEM_SELECTION",
        "Each Supply Item may appear only once in a Supply Request.",
        "items",
      );
    }
    selected.add(item.supplyItemId);
  }

  return parsed.data;
}

export function canonicalSupplyRequestItems(
  items: ValidatedCreateSupplyRequestInput["items"],
) {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }));
}

export function supplyRequestDateToUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
