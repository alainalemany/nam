import { z } from "zod";

import { shiftReportStatusValues, shiftValues } from "./constants";

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

export const shiftReportFormSchema = z.object({
  reportDate: z.coerce.date({
    error: "Report date is required.",
  }),
  shift: z.enum(shiftValues),
  status: z.enum(shiftReportStatusValues),
  mineId: optionalText(120),
  equipmentId: optionalText(120),
  location: optionalText(200),
  summary: requiredText("Shift summary", 1000),
  operationalNotes: optionalText(1000),
});

export type ShiftReportFormInput = z.infer<typeof shiftReportFormSchema>;

export type ShiftReportFormField = keyof ShiftReportFormInput;

export type ShiftReportFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<ShiftReportFormField, string[]>>;
};

export const emptyShiftReportFormState: ShiftReportFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
