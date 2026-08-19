import { z } from "zod";

export const lakeFormSchema = z.object({
  mineId: z.string().trim().min(1, "Mine is required.").max(200),
  name: z
    .string()
    .trim()
    .min(1, "Lake name is required.")
    .max(120, "Lake name must be 120 characters or fewer."),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .optional()
    .transform((value) => value || undefined),
});

export type LakeFormValues = {
  mineId: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  notes: string;
};

export type LakeFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<keyof LakeFormValues, string[]>>;
  values?: LakeFormValues;
};

export const emptyLakeFormState: LakeFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function lakeFieldErrors(error: z.ZodError) {
  const errors: LakeFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof LakeFormValues;
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}
