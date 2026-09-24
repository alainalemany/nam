import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(max, `Use ${max} characters or fewer.`).optional(),
  );

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().finite().optional(),
);

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

export const maintenanceComponentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: optionalText(1000),
  trackingUnit: z
    .string()
    .trim()
    .min(1, "Tracking unit is required.")
    .max(40),
  active: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export const maintenanceRuleSchema = z
  .object({
    actionName: z.string().trim().min(1, "Action is required.").max(120),
    counterScope: z.enum(["SERVICE_INTERVAL", "COMPONENT_LIFECYCLE"]),
    thresholdValue: z.coerce.number().finite().min(0),
    upperThresholdValue: optionalNumber,
    repeatable: checkbox,
    repeatIntervalValue: optionalNumber,
    maximumRepeatCount: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    warningLeadValue: optionalNumber,
    startsNewLifecycle: checkbox,
    active: checkbox,
    priority: z.coerce.number().int().min(0).max(10_000),
    sortOrder: z.coerce.number().int().min(0).max(10_000),
  })
  .superRefine((value, context) => {
    if (
      value.upperThresholdValue != null &&
      value.upperThresholdValue < value.thresholdValue
    ) {
      context.addIssue({
        code: "custom",
        path: ["upperThresholdValue"],
        message: "Upper threshold must be at or above the lower threshold.",
      });
    }
    if (value.warningLeadValue != null && value.warningLeadValue < 0) {
      context.addIssue({
        code: "custom",
        path: ["warningLeadValue"],
        message: "Warning lead must be zero or greater.",
      });
    }
    if (value.repeatable && (!value.repeatIntervalValue || value.repeatIntervalValue <= 0)) {
      context.addIssue({
        code: "custom",
        path: ["repeatIntervalValue"],
        message: "A repeatable rule needs a positive repeat interval.",
      });
    }
    if (!value.repeatable && value.repeatIntervalValue != null) {
      context.addIssue({
        code: "custom",
        path: ["repeatIntervalValue"],
        message: "Only repeatable rules can have a repeat interval.",
      });
    }
    if (!value.repeatable && value.maximumRepeatCount != null) {
      context.addIssue({
        code: "custom",
        path: ["maximumRepeatCount"],
        message: "Only repeatable rules can have a maximum repeat count.",
      });
    }
  });

export const maintenanceTrackerSchema = z.object({
  equipmentId: z.string().trim().min(1, "Equipment is required."),
  componentId: z.string().trim().min(1, "Component is required."),
  trackingStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tracking start date is required."),
  trackingStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Tracking start time is required."),
  installedComponentIdentity: optionalText(160),
  notes: optionalText(1000),
});

export const maintenanceAdjustmentSchema = z.object({
  adjustmentValue: z.coerce.number().finite().positive("Adjustment hours must be greater than zero."),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required."),
  effectiveTime: z.string().regex(/^\d{2}:\d{2}$/, "Effective time is required."),
  reason: z.string().trim().min(1, "A reason is required.").max(1000),
  recordedBy: optionalText(120),
  recordVersion: z.coerce.number().int().positive(),
});

export const maintenanceServiceSchema = z.object({
  ruleId: z.string().trim().min(1, "Service action is required."),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date is required."),
  effectiveTime: z.string().regex(/^\d{2}:\d{2}$/, "Effective time is required."),
  notes: optionalText(1000),
  recordedBy: optionalText(120),
  recordVersion: z.coerce.number().int().positive(),
});

export type MaintenanceActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
};

export const initialMaintenanceActionState: MaintenanceActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function maintenanceFormObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function maintenanceValidationState(error: z.ZodError): MaintenanceActionState {
  const flattened = error.flatten();
  return {
    status: "error",
    message: "Review the highlighted maintenance fields.",
    fieldErrors: flattened.fieldErrors as Record<string, string[]>,
  };
}
