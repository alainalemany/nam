import { z } from "zod";

import { dailyLogActivityTypeValues, shiftValues } from "./constants";

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

const requiredText = (label: string, max = 200) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`),
  );

export const dailyLogActivitySchema = z.object({
  activityType: z.enum(dailyLogActivityTypeValues),
  title: requiredText("Activity title"),
  startTime: optionalText(20),
  endTime: optionalText(20),
  description: optionalText(1000),
  equipmentId: optionalText(120),
  location: optionalText(160),
  contractorCompany: optionalText(160),
  personName: optionalText(160),
  notes: optionalText(1000),
});

export const dailyLogFormSchema = z.object({
  logDate: z.coerce.date({
    error: "Log date is required.",
  }),
  shift: z.enum(shiftValues),
  mineId: optionalText(120),
  primaryEquipmentId: optionalText(120),
  summary: requiredText("Summary", 500),
  weatherConditions: optionalText(240),
  generalNotes: optionalText(1500),
  activities: z.array(dailyLogActivitySchema).min(1, "Add at least one activity."),
});

export type DailyLogFormInput = z.infer<typeof dailyLogFormSchema>;

export type DailyLogFormField =
  | keyof Omit<DailyLogFormInput, "activities">
  | "activities";

export type DailyLogFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<DailyLogFormField, string[]>>;
};

export const emptyDailyLogFormState: DailyLogFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
