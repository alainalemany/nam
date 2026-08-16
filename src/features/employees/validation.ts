import { z } from "zod";

const optionalEmployeeCode = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().max(100, "Employee Code must be 100 characters or fewer.").optional(),
);

export const employeeFormSchema = z.object({
  displayName: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value),
    z
      .string({ message: "Display Name is required." })
      .min(1, "Display Name is required.")
      .max(200, "Display Name must be 200 characters or fewer."),
  ),
  employeeCode: optionalEmployeeCode,
  isActive: z.boolean(),
  isSupervisor: z.boolean(),
});

export type EmployeeFormInput = z.output<typeof employeeFormSchema>;

export function employeeFieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    (errors[field] ??= []).push(issue.message);
  }
  return errors;
}
