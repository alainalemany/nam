import { z } from "zod";

import {
  stopCardCategoryValues,
  stopCardSeverityValues,
  stopCardStatusValues,
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

export const stopCardFormSchema = z.object({
  observationDate: z.coerce.date({
    error: "Observation date is required.",
  }),
  category: z.enum(stopCardCategoryValues),
  severity: z.enum(stopCardSeverityValues),
  status: z.enum(stopCardStatusValues),
  mineId: optionalText(120),
  equipmentId: optionalText(120),
  location: optionalText(160),
  description: requiredText("Description", 1000),
  correctiveAction: optionalText(1000),
  createdBy: optionalText(160),
});

export type StopCardFormInput = z.infer<typeof stopCardFormSchema>;

export type StopCardFormField = keyof StopCardFormInput;

export type StopCardFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<StopCardFormField, string[]>>;
};

export const emptyStopCardFormState: StopCardFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
