import { z } from "zod";

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
  activityType: z.enum([
    "DRAGLINE_MOVE",
    "CUT",
    "GREASING",
    "SCHEDULED_PM",
    "EQUIPMENT_ALARM",
    "SENSOR_OBSERVATION",
    "EQUIPMENT_OBSERVATION",
    "WORK_ORDER",
    "WORK_AUTHORIZATION",
    "LOCKOUT_TAGOUT",
    "HOT_WORK",
    "WORKING_AT_HEIGHTS",
    "CONTRACTOR_ESCORT",
    "MAINTENANCE_OBSERVATION",
    "FUEL_SERVICE",
    "DELAY",
    "PRODUCTION_NOTE",
    "SAFETY_OBSERVATION",
    "GENERAL_NOTE",
  ]),
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
  shift: z.enum(["DAY", "NIGHT", "SWING", "OTHER", "UNKNOWN"]),
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
