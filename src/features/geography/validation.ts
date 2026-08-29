import { z } from "zod";

import { normalizeGeographyText, normalizeStateAbbreviation } from "./normalization";

export const stateSubmissionSchema = z.object({
  name: z.string().transform(normalizeGeographyText).pipe(
    z.string().min(1, "State name is required.").max(100, "State name must be 100 characters or fewer."),
  ),
  abbreviation: z.string().transform(normalizeStateAbbreviation).pipe(
    z.string().regex(/^[A-Z]{2}$/, "Use a two-letter State abbreviation."),
  ),
});

export const citySubmissionSchema = z.object({
  name: z.string().transform(normalizeGeographyText).pipe(
    z.string().min(1, "City name is required.").max(200, "City name must be 200 characters or fewer."),
  ),
  stateId: z.string().trim().min(1, "State is required.").max(200, "Select a valid State."),
});

export type StateSubmissionInput = z.infer<typeof stateSubmissionSchema>;
export type CitySubmissionInput = z.infer<typeof citySubmissionSchema>;

export type GeographyActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  values: Record<string, string>;
};

export const emptyGeographyActionState: GeographyActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {},
};

export function geographyFieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}
