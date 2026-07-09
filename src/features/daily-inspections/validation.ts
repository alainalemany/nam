import { z } from "zod";

import {
  dailyInspectionConditionValues,
  dailyInspectionStatusValues,
  shiftValues,
} from "./constants";

const optionalText = (max = 200) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max, `Use ${max} characters or fewer.`).optional(),
  );

const requiredText = (label: string, max = 500) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`),
  );

const optionalNumber = (label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.coerce
      .number(`${label} must be a number.`)
      .nonnegative(`${label} cannot be negative.`)
      .max(999999, `${label} is too large.`)
      .optional(),
  );

const checkboxBoolean = z.preprocess((value) => value === "on" || value === true, z.boolean());

export const dailyInspectionFormSchema = z.object({
  inspectionDate: z.coerce.date({
    error: "Inspection date is required.",
  }),
  shift: z.enum(shiftValues),
  mineId: optionalText(120),
  equipmentId: requiredText("Equipment", 120),
  equipmentHours: optionalNumber("Equipment hours"),
  condition: z.enum(dailyInspectionConditionValues),
  status: z.enum(dailyInspectionStatusValues),
  findings: requiredText("Findings", 1000),
  defectsIdentified: checkboxBoolean,
  notes: optionalText(1000),
});

export type DailyInspectionFormInput = z.infer<typeof dailyInspectionFormSchema>;

export type DailyInspectionFormField = keyof DailyInspectionFormInput;

export type DailyInspectionFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<DailyInspectionFormField, string[]>>;
};

export const emptyDailyInspectionFormState: DailyInspectionFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
