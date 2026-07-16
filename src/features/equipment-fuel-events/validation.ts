import { z } from "zod";

import {
  equipmentFuelTypeValues,
  maxEventGallons,
  maxGallonsPerFill,
  maxTankFills,
} from "./constants";
import { isEquipmentFuelDateOnly, isLocalEventTime } from "./date";

export type EquipmentFuelActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const emptyEquipmentFuelActionState: EquipmentFuelActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function normalizeFuelReference(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeFuelDisplayText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function deduplicateTankLabelSuggestions(labels: string[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const normalized = normalizeFuelReference(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

const requiredString = (label: string, max: number) =>
  z.string().transform(normalizeFuelDisplayText).pipe(
    z.string().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`),
  );

const optionalId = z.string().trim().optional().transform((value) => value || undefined);

const integerFromInput = (label: string, minimum: number, maximum: number) =>
  z.preprocess(
    (value) => {
      if (typeof value === "number") return value;
      if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return Number.NaN;
      return Number(value.trim());
    },
    z.number({ message: `${label} must be a whole number.` })
      .int(`${label} must be a whole number.`)
      .min(minimum, `${label} must be at least ${minimum}.`)
      .max(maximum, `${label} must be ${maximum} or fewer.`),
  );

export const equipmentFuelTankFillSchema = z.object({
  sequence: integerFromInput("Sequence", 1, maxTankFills),
  tankLabel: requiredString("Tank label", 100),
  gallons: integerFromInput("Gallons", 1, maxGallonsPerFill),
});

export const equipmentFuelEventSubmissionSchema = z.object({
  operationalWorkDate: z.string().refine(isEquipmentFuelDateOnly, "Enter a valid operational work date."),
  eventTime: z.string().refine(isLocalEventTime, "Enter a valid local event time in HH:mm format."),
  equipmentId: requiredString("Equipment", 200),
  fuelType: z.enum(equipmentFuelTypeValues, { message: "Select an approved fuel type." }),
  fuelServicePersonId: optionalId,
  newFuelServicePersonDisplayName: z.string().trim().max(200, "Fuel Service Person must be 200 characters or fewer.").optional().transform((value) => value || undefined),
  dailyLogActivityId: optionalId,
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer.").optional().transform((value) => value || undefined),
  tankFills: z.array(equipmentFuelTankFillSchema).min(1, "Add at least one Tank Fill.").max(maxTankFills, `An event may contain at most ${maxTankFills} Tank Fills.`),
}).superRefine((value, context) => {
  if (value.fuelServicePersonId && value.newFuelServicePersonDisplayName) {
    context.addIssue({ code: "custom", path: ["newFuelServicePersonDisplayName"], message: "Select an existing person or create a new one, not both." });
  }

  const labels = new Map<string, number>();
  let total = 0;
  value.tankFills.forEach((fill, index) => {
    if (fill.sequence !== index + 1) {
      context.addIssue({ code: "custom", path: ["tankFills", index, "sequence"], message: "Tank Fill sequence must be contiguous and start at 1." });
    }
    const normalized = normalizeFuelReference(fill.tankLabel);
    const prior = labels.get(normalized);
    if (prior !== undefined) {
      context.addIssue({ code: "custom", path: ["tankFills", index, "tankLabel"], message: `Tank label duplicates Tank Fill ${prior + 1}.` });
    } else {
      labels.set(normalized, index);
    }
    total += fill.gallons;
  });
  if (total > maxEventGallons) {
    context.addIssue({ code: "custom", path: ["tankFills"], message: `Total delivered gallons must not exceed ${maxEventGallons}.` });
  }
});

export type EquipmentFuelEventSubmissionInput = z.infer<typeof equipmentFuelEventSubmissionSchema>;

export const fuelServicePersonSchema = z.object({
  displayName: requiredString("Display name", 200),
  active: z.boolean(),
});

export function equipmentFuelFieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}
