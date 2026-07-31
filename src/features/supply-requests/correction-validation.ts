import { z } from "zod";

import {
  supplyRequestMaximumIdentifierLength,
  supplyRequestMaximumItemCount,
  supplyRequestMaximumLifecycleNarrativeLength,
  supplyRequestMaximumNotesLength,
  supplyRequestMaximumQuantity,
} from "./constants";
import {
  SupplyRequestCorrectionError,
} from "./correction-errors";
import {
  isCanonicalSupplyRequestDate,
  isCanonicalSupplyRequestLocalTime,
} from "./validation";

const intMaximum = 2_147_483_647;
const identifier = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(
      supplyRequestMaximumIdentifierLength,
      `${label} must be ${supplyRequestMaximumIdentifierLength} characters or fewer.`,
    );
const date = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .refine(
      isCanonicalSupplyRequestDate,
      `Enter a real ${label.toLowerCase()} in YYYY-MM-DD format.`,
    );
const time = (label: string) =>
  z
    .string({ message: `${label} is required.` })
    .refine(
      isCanonicalSupplyRequestLocalTime,
      `Enter ${label.toLowerCase()} in HH:mm format.`,
    );
const optionalNarrative = (label: string, maximum: number) =>
  z
    .string({ message: `${label} must be text.` })
    .trim()
    .max(maximum, `${label} must be ${maximum} characters or fewer.`)
    .optional()
    .transform((value) => value || undefined);

export const correctSupplyRequestInputSchema = z
  .object({
    supplyRequestId: identifier("Supply Request"),
    expectedCurrentVersionNumber: z
      .number({ message: "Expected current version must be a number." })
      .int("Expected current version must be a whole number.")
      .safe("Expected current version must be a safe whole number.")
      .min(1, "Expected current version must be at least 1.")
      .max(intMaximum, "Expected current version is outside the supported range."),
    correctionReason: z
      .string({ message: "Correction Reason is required." })
      .trim()
      .min(1, "Correction Reason is required.")
      .max(
        supplyRequestMaximumLifecycleNarrativeLength,
        `Correction Reason must be ${supplyRequestMaximumLifecycleNarrativeLength} characters or fewer.`,
      ),
    operationalWorkDate: date("Operational work date"),
    submittedLocalDate: date("Submitted local date"),
    submittedLocalTime: time("Submitted local time"),
    equipmentId: identifier("Equipment"),
    supervisorId: identifier("Supervisor"),
    notes: optionalNarrative("Notes", supplyRequestMaximumNotesLength),
    resultingStatus: z.enum(["REQUESTED", "FULFILLED", "CANCELLED"]),
    items: z
      .array(
        z
          .object({
            supplyItemId: identifier("Supply Item"),
            quantity: z
              .number({ message: "Quantity must be a whole number." })
              .int("Quantity must be a whole number.")
              .safe("Quantity must be a safe whole number.")
              .min(1, "Quantity must be at least 1.")
              .max(
                supplyRequestMaximumQuantity,
                `Quantity must be ${supplyRequestMaximumQuantity} or fewer.`,
              ),
          })
          .strict(),
      )
      .min(1, "Add at least one Supply Item.")
      .max(
        supplyRequestMaximumItemCount,
        `A Supply Request may contain at most ${supplyRequestMaximumItemCount} items.`,
      ),
    fulfillmentOperationalWorkDate: date(
      "Fulfillment operational work date",
    ).optional(),
    fulfilledLocalDate: date("Fulfilled local date").optional(),
    fulfilledLocalTime: time("Fulfilled local time").optional(),
    fulfillmentNote: optionalNarrative(
      "Fulfillment Note",
      supplyRequestMaximumLifecycleNarrativeLength,
    ),
    cancelledLocalDate: date("Cancelled local date").optional(),
    cancelledLocalTime: time("Cancelled local time").optional(),
    cancellationReason: optionalNarrative(
      "Cancellation Reason",
      supplyRequestMaximumLifecycleNarrativeLength,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    const fulfillment = [
      value.fulfillmentOperationalWorkDate,
      value.fulfilledLocalDate,
      value.fulfilledLocalTime,
      value.fulfillmentNote,
    ];
    const cancellation = [
      value.cancelledLocalDate,
      value.cancelledLocalTime,
      value.cancellationReason,
    ];
    const issue = (field: string, message: string) =>
      context.addIssue({ code: "custom", path: [field], message });

    if (value.resultingStatus === "REQUESTED") {
      if (fulfillment.some((entry) => entry !== undefined)) {
        issue("resultingStatus", "Requested corrections cannot include fulfillment facts.");
      }
      if (cancellation.some((entry) => entry !== undefined)) {
        issue("resultingStatus", "Requested corrections cannot include cancellation facts.");
      }
    }
    if (value.resultingStatus === "FULFILLED") {
      if (
        !value.fulfillmentOperationalWorkDate ||
        !value.fulfilledLocalDate ||
        !value.fulfilledLocalTime
      ) {
        issue("resultingStatus", "Fulfilled corrections require complete fulfillment facts.");
      }
      if (cancellation.some((entry) => entry !== undefined)) {
        issue("resultingStatus", "Fulfilled corrections cannot include cancellation facts.");
      }
      if (
        value.fulfillmentOperationalWorkDate &&
        value.fulfillmentOperationalWorkDate < value.operationalWorkDate
      ) {
        issue(
          "fulfillmentOperationalWorkDate",
          "Fulfillment operational work date cannot be before the corrected operational work date.",
        );
      }
      if (
        value.fulfilledLocalDate &&
        value.fulfilledLocalTime &&
        `${value.fulfilledLocalDate}T${value.fulfilledLocalTime}` <
          `${value.submittedLocalDate}T${value.submittedLocalTime}`
      ) {
        issue(
          "fulfilledLocalDate",
          "Fulfilled local date and time cannot be before the corrected submitted local date and time.",
        );
      }
    }
    if (value.resultingStatus === "CANCELLED") {
      if (!value.cancelledLocalDate || !value.cancelledLocalTime) {
        issue("resultingStatus", "Cancelled corrections require complete cancellation facts.");
      }
      if (fulfillment.some((entry) => entry !== undefined)) {
        issue("resultingStatus", "Cancelled corrections cannot include fulfillment facts.");
      }
      if (
        value.cancelledLocalDate &&
        value.cancelledLocalTime &&
        `${value.cancelledLocalDate}T${value.cancelledLocalTime}` <
          `${value.submittedLocalDate}T${value.submittedLocalTime}`
      ) {
        issue(
          "cancelledLocalDate",
          "Cancelled local date and time cannot be before the corrected submitted local date and time.",
        );
      }
    }

    const ids = new Set<string>();
    value.items.forEach((item, index) => {
      if (ids.has(item.supplyItemId)) {
        issue(`items.${index}.supplyItemId`, "Each Supply Item may appear only once.");
      }
      ids.add(item.supplyItemId);
    });
  });

export type CorrectSupplyRequestInput = z.input<
  typeof correctSupplyRequestInputSchema
>;
export type ValidatedCorrectSupplyRequestInput = z.output<
  typeof correctSupplyRequestInputSchema
>;

function fieldErrors(error: z.ZodError) {
  const result: Record<string, string[]> = {};
  error.issues.forEach((issue) => {
    const field = issue.path.join(".") || "form";
    (result[field] ??= []).push(issue.message);
  });
  return result;
}

export function parseCorrectSupplyRequestInput(input: CorrectSupplyRequestInput) {
  const parsed = correctSupplyRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new SupplyRequestCorrectionError(
      "INVALID_INPUT",
      "Check the corrected Supply Request details before saving a new version in NAM.",
      undefined,
      fieldErrors(parsed.error),
    );
  }
  return parsed.data;
}
