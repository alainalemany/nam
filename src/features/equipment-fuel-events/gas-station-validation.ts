import { z } from "zod";

import { normalizeFuelDisplayText } from "./validation";

const optionalText = (maximum: number, message: string) =>
  z.string().transform(normalizeFuelDisplayText).pipe(
    z.string().max(maximum, message),
  ).transform((value) => value || undefined);

export const gasStationSubmissionSchema = z.object({
  name: z.string().transform(normalizeFuelDisplayText).pipe(
    z.string().min(1, "Station name is required.").max(200, "Station name must be 200 characters or fewer."),
  ),
  address: optionalText(300, "Address must be 300 characters or fewer."),
  cityId: z.string().trim().min(1, "City is required.").max(200, "Select a valid City."),
  postalCode: optionalText(20, "ZIP/postal code must be 20 characters or fewer."),
});

export type GasStationSubmissionInput = z.infer<typeof gasStationSubmissionSchema>;

export type GasStationActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Record<string, string[]>;
  values: {
    name: string;
    address: string;
    cityId: string;
    postalCode: string;
  };
};

export const emptyGasStationActionState: GasStationActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: { name: "", address: "", cityId: "", postalCode: "" },
};

export function gasStationFieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    (errors[path] ??= []).push(issue.message);
  }
  return errors;
}
