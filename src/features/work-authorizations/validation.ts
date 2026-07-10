import { z } from "zod";

import {
  workAuthorizationStatusValues,
  workAuthorizationWorkTypeValues,
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

const optionalInteger = (label: string) =>
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
      .int(`${label} must be a whole number.`)
      .nonnegative(`${label} cannot be negative.`)
      .max(999, `${label} is too large.`)
      .optional(),
  );

const checkboxBoolean = z.preprocess((value) => value === "on" || value === true, z.boolean());

const completionFields = [
  "jobCompleted",
  "permitsClosed",
  "guardsReplaced",
  "lockoutTagoutRemoved",
  "toolsRemoved",
  "housekeepingCompleted",
  "supervisorNotified",
] as const;

export const workAuthorizationFormSchema = z
  .object({
    shiftReportId: requiredText("Shift Report", 120),
    status: z.enum(workAuthorizationStatusValues),
    workType: z.enum(workAuthorizationWorkTypeValues),
    mineId: optionalText(120),
    equipmentId: optionalText(120),
    jobLocation: optionalText(200),
    workDescription: requiredText("Work description", 1000),
    startTime: optionalText(20),
    endTime: optionalText(20),
    crewWorkerCount: optionalInteger("Crew worker count"),
    contactName: optionalText(200),
    equipmentRequired: optionalText(500),
    personInChargeName: optionalText(200),
    lockoutRequired: checkboxBoolean,
    lockoutNotRequiredReason: optionalText(500),
    workplaceExamRequired: checkboxBoolean,
    confinedSpaceRequired: checkboxBoolean,
    lockoutTagoutRequired: checkboxBoolean,
    hotWorkRequired: checkboxBoolean,
    workingAtHeightsRequired: checkboxBoolean,
    stopCardJhaRequired: checkboxBoolean,
    jobCompleted: checkboxBoolean,
    permitsClosed: checkboxBoolean,
    guardsReplaced: checkboxBoolean,
    lockoutTagoutRemoved: checkboxBoolean,
    toolsRemoved: checkboxBoolean,
    housekeepingCompleted: checkboxBoolean,
    supervisorNotified: checkboxBoolean,
    completionNotes: optionalText(1000),
  })
  .superRefine((value, context) => {
    if (!value.lockoutRequired && !value.lockoutNotRequiredReason) {
      context.addIssue({
        code: "custom",
        message: "Explain why lockout is not required.",
        path: ["lockoutNotRequiredReason"],
      });
    }

    if (value.status === "CLOSED") {
      for (const field of completionFields) {
        if (!value[field]) {
          context.addIssue({
            code: "custom",
            message: "Complete all checklist items before closing.",
            path: [field],
          });
        }
      }
    }
  });

export type WorkAuthorizationFormInput = z.infer<typeof workAuthorizationFormSchema>;

export type WorkAuthorizationFormField = keyof WorkAuthorizationFormInput;

export type WorkAuthorizationFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<WorkAuthorizationFormField, string[]>>;
};

export const emptyWorkAuthorizationFormState: WorkAuthorizationFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
