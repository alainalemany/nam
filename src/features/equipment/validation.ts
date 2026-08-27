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

const equipmentFields = {
  mineId: requiredText("Mine"),
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

export const equipmentFormSchema = z.object(equipmentFields);

export const equipmentEditFormSchema = equipmentFormSchema;

export type EquipmentFormInput = z.infer<typeof equipmentFormSchema>;
export type EquipmentEditFormInput = z.infer<typeof equipmentEditFormSchema>;

export type EquipmentFormField = keyof EquipmentFormInput;

export type EquipmentFormValues = {
  mineId: string;
  displayName: string;
  equipmentNumber: string;
  category: string;
  make: string;
  model: string;
  powerType: string;
  instrumentationType: string;
  hasDigitalAlarmScreen: boolean;
  status: string;
  notes: string;
};

export function equipmentFormValues(formData: FormData): EquipmentFormValues {
  const value = (field: EquipmentFormField) => {
    const fieldValue = formData.get(field);
    return typeof fieldValue === "string" ? fieldValue : "";
  };

  return {
    mineId: value("mineId"),
    displayName: value("displayName"),
    equipmentNumber: value("equipmentNumber"),
    category: value("category"),
    make: value("make"),
    model: value("model"),
    powerType: value("powerType"),
    instrumentationType: value("instrumentationType"),
    hasDigitalAlarmScreen: formData.has("hasDigitalAlarmScreen"),
    status: value("status"),
    notes: value("notes"),
  };
}

export type EquipmentFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<EquipmentFormField, string[]>>;
  values?: EquipmentFormValues;
};

export const emptyEquipmentFormState: EquipmentFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
