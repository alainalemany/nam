import { z } from "zod";

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

export const equipmentFormSchema = z.object({
  cityName: requiredText("City"),
  cityState: optionalText(40),
  mineName: requiredText("Mine"),
  mineType: optionalText(80),
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
});

export type EquipmentFormInput = z.infer<typeof equipmentFormSchema>;

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
