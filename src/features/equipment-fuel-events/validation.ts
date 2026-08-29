import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  equipmentFuelMeterTypeValues,
  equipmentFuelTypeValues,
  maxEventGallons,
  maxFuelEventCost,
  maxGallonsPerFill,
  maxTankFills,
} from "./constants";
import { isEquipmentFuelDateOnly, isLocalEventTime } from "./date";
import type { EquipmentFuelEventSubmittedValues } from "./types";

export type EquipmentFuelActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  values?: EquipmentFuelEventSubmittedValues;
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

function decimalValueSchema(
  label: string,
  options: { maximum: number | string; allowZero?: boolean },
) {
  const invalid = `${label} must be a number with no more than 3 decimal places.`;
  return z.preprocess(
    (value) => typeof value === "number" ? String(value) : value,
    z.string({ message: invalid })
      .trim()
      .regex(/^\d+(?:\.\d{1,3})?$/, invalid)
      .transform((value) => new Prisma.Decimal(value))
      .refine(
        (value) => options.allowZero ? value.greaterThanOrEqualTo(0) : value.greaterThan(0),
        options.allowZero ? `${label} must be zero or greater.` : `${label} must be greater than zero.`,
      )
      .refine((value) => value.lessThanOrEqualTo(options.maximum), `${label} must be ${options.maximum} or fewer.`),
  );
}

function optionalDecimalFromInput(
  label: string,
  options: { maximum: number | string; allowZero?: boolean },
) {
  const valueSchema = decimalValueSchema(label, options);
  return z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    valueSchema.optional(),
  );
}

const optionalDisplayText = (maximum: number, message: string) =>
  z.string().trim().max(maximum, message).optional().transform((value) => value || undefined);

export const equipmentFuelTankFillSchema = z.object({
  sequence: integerFromInput("Sequence", 1, maxTankFills),
  tankLabel: requiredString("Tank label", 100),
  gallons: decimalValueSchema("Gallons", { maximum: maxGallonsPerFill }),
});

const baseEquipmentFuelEventSubmissionSchema = z.object({
  operationalWorkDate: z.string().refine(isEquipmentFuelDateOnly, "Enter a valid operational work date."),
  eventTime: z.string().refine(isLocalEventTime, "Enter a valid local event time in HH:mm format."),
  equipmentId: requiredString("Equipment", 200),
  fuelType: z.enum(equipmentFuelTypeValues, { message: "Select an approved fuel type." }),
  gasStationId: z.string().trim().max(200, "Select a valid Gas Station.").optional().transform((value) => value || undefined),
  pricePerGallon: optionalDecimalFromInput("Price per gallon", { maximum: "9999999.999" }),
  meterType: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.enum(equipmentFuelMeterTypeValues, { message: "Select a valid meter type." }).optional(),
  ),
  meterReading: optionalDecimalFromInput("Meter reading", { maximum: "99999999999.999", allowZero: true }),
  receiptReference: optionalDisplayText(200, "Receipt reference must be 200 characters or fewer."),
  notes: optionalDisplayText(2000, "Notes must be 2000 characters or fewer."),
  tankFills: z.array(equipmentFuelTankFillSchema).min(1, "Add at least one Tank Fill.").max(maxTankFills, `An event may contain at most ${maxTankFills} Tank Fills.`),
});

function addAggregateRules(
  value: z.infer<typeof baseEquipmentFuelEventSubmissionSchema>,
  context: z.RefinementCtx,
  requireV2: boolean,
) {
  const labels = new Map<string, number>();
  let total = new Prisma.Decimal(0);
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
    if (Prisma.Decimal.isDecimal(fill.gallons)) total = total.plus(fill.gallons);
  });
  if (total.greaterThan(maxEventGallons)) {
    context.addIssue({ code: "custom", path: ["tankFills"], message: `Total delivered gallons must not exceed ${maxEventGallons}.` });
  }
  if (
    Prisma.Decimal.isDecimal(value.pricePerGallon) &&
    total.times(value.pricePerGallon).greaterThan(maxFuelEventCost)
  ) {
    context.addIssue({ code: "custom", path: ["pricePerGallon"], message: "Price and delivered gallons produce a total cost above the supported maximum." });
  }

  const hasAnyV2Context = Boolean(
    value.gasStationId || value.pricePerGallon || value.meterType || value.meterReading,
  );
  if (requireV2 || hasAnyV2Context) {
    if (!value.gasStationId) context.addIssue({ code: "custom", path: ["gasStationId"], message: "Gas Station is required." });
    if (!value.pricePerGallon) context.addIssue({ code: "custom", path: ["pricePerGallon"], message: "Price per gallon is required." });
    if (!value.meterType) context.addIssue({ code: "custom", path: ["meterType"], message: "Meter type is required." });
  }
  if (value.meterType === "HOURS" || value.meterType === "ODOMETER") {
    if (!value.meterReading) {
      context.addIssue({ code: "custom", path: ["meterReading"], message: "Meter reading is required for Hours or Odometer." });
    }
  } else if (value.meterType === "NOT_APPLICABLE" && value.meterReading) {
    context.addIssue({ code: "custom", path: ["meterReading"], message: "Meter reading must be blank when the meter type is Not Applicable." });
  } else if (!value.meterType && value.meterReading) {
    context.addIssue({ code: "custom", path: ["meterType"], message: "Select a meter type for this reading." });
  }
}

export const equipmentFuelEventSubmissionSchema = baseEquipmentFuelEventSubmissionSchema.superRefine(
  (value, context) => addAggregateRules(value, context, true),
);

export const equipmentFuelEventCorrectionSchema = baseEquipmentFuelEventSubmissionSchema.superRefine(
  (value, context) => addAggregateRules(value, context, false),
);

export type EquipmentFuelEventSubmissionInput = z.infer<typeof baseEquipmentFuelEventSubmissionSchema>;

export const fuelServicePersonSchema = z.object({
  displayName: requiredString("Display name", 200),
  active: z.boolean(),
});

function rawString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function equipmentFuelSubmittedValues(
  payload: unknown,
): EquipmentFuelEventSubmittedValues | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;

  const source = payload as Record<string, unknown>;
  const rawFills = Array.isArray(source.tankFills) ? source.tankFills : [];
  const usedRowIds = new Set<string>();
  const tankFills = rawFills.map((rawFill, index) => {
    const fill = rawFill && typeof rawFill === "object" && !Array.isArray(rawFill)
      ? rawFill as Record<string, unknown>
      : {};
    const proposedRowId = rawString(fill.clientRowId).trim().slice(0, 100);
    let clientRowId = proposedRowId || `submitted-tank-fill-${index + 1}`;
    let suffix = 1;
    while (usedRowIds.has(clientRowId)) {
      clientRowId = `submitted-tank-fill-${index + 1}-${suffix}`;
      suffix += 1;
    }
    usedRowIds.add(clientRowId);
    return {
      clientRowId,
      sequence: index + 1,
      tankLabel: rawString(fill.tankLabel),
      gallons: rawString(fill.gallons),
    };
  });

  return {
    operationalWorkDate: rawString(source.operationalWorkDate),
    eventTime: rawString(source.eventTime),
    equipmentId: rawString(source.equipmentId),
    fuelType: rawString(source.fuelType),
    gasStationId: rawString(source.gasStationId),
    pricePerGallon: rawString(source.pricePerGallon),
    meterType: rawString(source.meterType),
    meterReading: rawString(source.meterReading),
    receiptReference: rawString(source.receiptReference),
    notes: rawString(source.notes),
    tankFills,
  };
}

export function equipmentFuelFieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}
