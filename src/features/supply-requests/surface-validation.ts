import { z } from "zod";

import { supplyRequestMaximumIdentifierLength } from "./constants";
import { SupplyRequestCreateError } from "./errors";
import type {
  SupplyRequestCreateFormValues,
  SupplyRequestSelectedItemInput,
} from "./surface-types";
import {
  parseCreateSupplyRequestInput,
  type ValidatedCreateSupplyRequestInput,
} from "./validation";

const routeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(supplyRequestMaximumIdentifierLength);
const searchQuerySchema = z.string().trim().max(200);
const originalVersionPattern = /^1$/;
const maximumSerializedItemsLength = 50_000;
const permittedCreateFields = new Set([
  "operationalWorkDate",
  "submittedLocalDate",
  "submittedLocalTime",
  "equipmentId",
  "supervisorId",
  "notes",
  "itemsPayload",
  "corporateSubmissionConfirmed",
]);

const selectedItemsSchema = z
  .array(
    z
      .object({
        supplyItemId: z
          .string()
          .trim()
          .min(1)
          .max(supplyRequestMaximumIdentifierLength),
        quantity: z.number(),
      })
      .strict(),
  )
  .max(50);

function formValue(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function invalidForm(
  message: string,
  field = "form",
  fieldErrors: Readonly<Record<string, readonly string[]>> = {
    [field]: [message],
  },
): never {
  throw new SupplyRequestCreateError(
    "INVALID_INPUT",
    "Check the Supply Request details before recording it in NAM.",
    field,
    fieldErrors,
  );
}

function assertStrictCreateFields(formData: FormData) {
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (
    [...counts].some(
      ([key, count]) => !permittedCreateFields.has(key) || count !== 1,
    )
  ) {
    invalidForm("The submitted form contained unexpected or repeated fields.");
  }
}

export function parseSupplyRequestSearchQuery(input: unknown) {
  const first = Array.isArray(input) ? input[0] : input;
  const parsed = searchQuerySchema.safeParse(first ?? "");
  return parsed.success ? parsed.data : null;
}

export function parseSupplyRequestRouteId(input: unknown) {
  const parsed = routeIdSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseSupplyRequestOriginalVersion(input: unknown) {
  const first = Array.isArray(input) ? input[0] : input;
  return typeof first === "string" && originalVersionPattern.test(first)
    ? 1
    : null;
}

export function parseSupplyRequestSelectedItemsPayload(
  payload: unknown,
): SupplyRequestSelectedItemInput[] {
  if (
    typeof payload !== "string" ||
    payload.length === 0 ||
    payload.length > maximumSerializedItemsLength
  ) {
    invalidForm("The selected Supply Item list is invalid.", "items");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    invalidForm("The selected Supply Item list is invalid.", "items");
  }

  const parsed = selectedItemsSchema.safeParse(decoded);
  if (!parsed.success) {
    invalidForm("The selected Supply Item list is invalid.", "items");
  }
  return parsed.data;
}

export function supplyRequestCreateFormValues(
  formData: FormData,
): SupplyRequestCreateFormValues {
  return {
    operationalWorkDate: formValue(formData, "operationalWorkDate"),
    submittedLocalDate: formValue(formData, "submittedLocalDate"),
    submittedLocalTime: formValue(formData, "submittedLocalTime"),
    equipmentId: formValue(formData, "equipmentId"),
    supervisorId: formValue(formData, "supervisorId"),
    notes: formValue(formData, "notes"),
    corporateSubmissionConfirmed:
      formValue(formData, "corporateSubmissionConfirmed") === "true",
  };
}

export function parseSupplyRequestCreateFormData(formData: FormData): {
  input: ValidatedCreateSupplyRequestInput;
  values: SupplyRequestCreateFormValues;
  items: SupplyRequestSelectedItemInput[];
} {
  assertStrictCreateFields(formData);
  const values = supplyRequestCreateFormValues(formData);
  const items = parseSupplyRequestSelectedItemsPayload(
    formValue(formData, "itemsPayload"),
  );
  const input = parseCreateSupplyRequestInput({
    operationalWorkDate: values.operationalWorkDate,
    submittedLocalDate: values.submittedLocalDate,
    submittedLocalTime: values.submittedLocalTime,
    equipmentId: values.equipmentId,
    supervisorId: values.supervisorId,
    notes: values.notes,
    corporateSubmissionConfirmed: values.corporateSubmissionConfirmed,
    items,
  });
  return { input, values, items };
}
