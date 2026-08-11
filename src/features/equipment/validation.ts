import { z } from "zod";

import { cityStateOptions, mineTypeOptions } from "./constants";

const requiredText = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(120, `${label} is too long.`),
  );

const optionalText = (max = 120) =>
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

const checkboxValue = z.preprocess(
  (value) => value === "on" || value === "true",
  z.boolean(),
);

export const cityStateSchema = z.enum(
  cityStateOptions.map((option) => option.value),
);

export const mineTypeSchema = z.enum(
  mineTypeOptions.map((option) => option.value),
);

const equipmentFields = {
  cityName: requiredText("City"),
  mineName: requiredText("Mine"),
  displayName: requiredText("Display name"),
  equipmentNumber: optionalText(80),
  category: z.enum([
    "DRAGLINE",
    "TRACTOR",
    "FORKLIFT",
    "WORK_TRUCK",
    "CABLE_SYSTEM",
    "CABLE_POLE",
    "CABLE_HANDLING_TOOL",
    "SUPPORT_TOOL",
    "OTHER",
  ]),
  make: optionalText(80),
  model: optionalText(80),
  powerType: z
    .enum(["ELECTRIC", "DIESEL", "GASOLINE", "HYBRID", "OTHER", "UNKNOWN"])
    .optional()
    .or(z.literal("")),
  instrumentationType: z
    .enum([
      "DIGITAL_ALARM_SCREEN",
      "SENSOR_DISPLAY",
      "PHYSICAL_GAUGES",
      "OPERATOR_OBSERVED",
      "MIXED",
      "UNKNOWN",
    ])
    .optional()
    .or(z.literal("")),
  hasDigitalAlarmScreen: checkboxValue,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  notes: optionalText(1000),
};

export const equipmentFormSchema = z.object({
  ...equipmentFields,
  cityState: cityStateSchema,
  mineType: mineTypeSchema,
});

export const equipmentEditFormSchema = z.object({
  ...equipmentFields,
  cityState: z.string().max(40, "Use 40 characters or fewer."),
  mineType: z.string().max(80, "Use 80 characters or fewer."),
});

export type EquipmentFormInput = z.infer<typeof equipmentFormSchema>;
export type EquipmentEditFormInput = z.infer<typeof equipmentEditFormSchema>;

export type EquipmentFormField = keyof EquipmentFormInput;

export type EquipmentFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<EquipmentFormField, string[]>>;
};

export const emptyEquipmentFormState: EquipmentFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
