import { z } from "zod";

import {
  safetyChecklistMeterKindValues,
  safetyChecklistShiftValues,
} from "./constants";
import { isSafetyChecklistDateOnly } from "./date";
import {
  getResponseOption,
  getSafetyChecklistTemplate,
  safetyChecklistResponseCodeValues,
  safetyChecklistTemplateKeys,
} from "./templates";

const requiredText = (label: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`),
  );

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed || undefined;
    },
    z.string().max(max, `Use ${max} characters or fewer.`).optional(),
  );

const integerMeter = z.preprocess(
  (value) => {
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return value;
  },
  z
    .number({ error: "Starting Meter Reading must be a whole number." })
    .int("Starting Meter Reading must be a whole number.")
    .min(0, "Starting Meter Reading cannot be negative.")
    .max(999999, "Starting Meter Reading must be 999999 or less."),
);

const transientConfirmation = z.preprocess(
  (value) => value === true || value === "true" || value === "on",
  z.boolean(),
);

export const safetyChecklistResponseInputSchema = z.object({
  itemKey: z.string().trim().min(1),
  responseCode: z.enum(safetyChecklistResponseCodeValues),
});

export const safetyChecklistSubmissionSchema = z
  .object({
    inspectionDate: z
      .string()
      .trim()
      .refine(isSafetyChecklistDateOnly, "Inspection date must be a valid date."),
    shift: z.enum(safetyChecklistShiftValues),
    equipmentId: requiredText("Equipment", 120),
    templateKey: z.enum(safetyChecklistTemplateKeys),
    templateVersion: z.coerce.number().int().positive(),
    meterKind: z.enum(safetyChecklistMeterKindValues, {
      error: "Select Hours or Miles for the Starting Meter Reading.",
    }),
    startingMeter: integerMeter,
    meterMismatchConfirmed: transientConfirmation,
    operatorDisplayName: requiredText("Operator", 120),
    supervisorDisplayName: requiredText("Supervisor", 120),
    problemDescription: optionalText(2000),
    responses: z.array(safetyChecklistResponseInputSchema).max(40),
  })
  .superRefine((input, context) => {
    const template = getSafetyChecklistTemplate(input.templateKey, input.templateVersion);
    if (!template) {
      context.addIssue({
        code: "custom",
        path: ["templateKey"],
        message: "The selected checklist template is not available.",
      });
      return;
    }

    const seen = new Map<string, number>();
    for (const [index, response] of input.responses.entries()) {
      if (seen.has(response.itemKey)) {
        context.addIssue({
          code: "custom",
          path: ["responses", response.itemKey],
          message: "This checklist item has more than one response.",
        });
        continue;
      }
      seen.set(response.itemKey, index);

      const field = template.fields.find((candidate) => candidate.key === response.itemKey);
      if (!field) {
        context.addIssue({
          code: "custom",
          path: ["responses", index, "itemKey"],
          message: "This checklist item does not belong to the selected template.",
        });
      } else if (!getResponseOption(field.responseSet, response.responseCode)) {
        context.addIssue({
          code: "custom",
          path: ["responses", response.itemKey],
          message: `${field.label} has an invalid response.`,
        });
      }
    }

    for (const field of template.fields) {
      if (!seen.has(field.key)) {
        context.addIssue({
          code: "custom",
          path: ["responses", field.key],
          message: `${field.label} requires a response.`,
        });
      }
    }

    if (
      input.responses.some((response) => response.responseCode === "NEEDS_REPAIR") &&
      !input.problemDescription
    ) {
      context.addIssue({
        code: "custom",
        path: ["problemDescription"],
        message: "Problem Description is required when an item Needs Repair.",
      });
    }
  });

export type SafetyChecklistSubmissionInput = z.infer<
  typeof safetyChecklistSubmissionSchema
>;

export type SafetyChecklistActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const emptySafetyChecklistActionState: SafetyChecklistActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export const safetyChecklistCreateAnotherSourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);

export function safetyChecklistFieldErrors(
  error: z.ZodError,
  responses: Array<{ itemKey: string }>,
) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = [...issue.path];
    if (path[0] === "responses" && typeof path[1] === "number") {
      path.splice(1, 1, responses[path[1]]?.itemKey ?? "unknown");
      if (path[2] === "responseCode" || path[2] === "itemKey") path.splice(2, 1);
    }
    const key = path.join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}
