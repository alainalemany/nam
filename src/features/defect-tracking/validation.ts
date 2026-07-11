import { z } from "zod";

import {
  defectPriorityValues,
  defectSeverityValues,
  defectStatusValues,
} from "./constants";

const optionalText = (max: number) =>
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

const requiredText = (label: string, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`),
  );

export const defectFormSchema = z
  .object({
    reportedDate: z.coerce.date({ error: "Reported date is required." }),
    equipmentId: requiredText("Equipment", 120),
    sourceDailyInspectionId: optionalText(120),
    severity: z.enum(defectSeverityValues),
    priority: z.enum(defectPriorityValues),
    status: z.enum(defectStatusValues),
    title: requiredText("Title", 200),
    description: requiredText("Description", 2000),
    correctiveAction: optionalText(2000),
    resolutionSummary: optionalText(2000),
  })
  .superRefine((value, context) => {
    if (
      (value.status === "RESOLVED" || value.status === "CLOSED") &&
      !value.resolutionSummary
    ) {
      context.addIssue({
        code: "custom",
        path: ["resolutionSummary"],
        message: "Resolution summary is required before resolving a defect.",
      });
    }
  });

export type DefectFormInput = z.infer<typeof defectFormSchema>;
export type DefectFormField = keyof DefectFormInput;

export type DefectFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<DefectFormField, string[]>>;
};

export const emptyDefectFormState: DefectFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
