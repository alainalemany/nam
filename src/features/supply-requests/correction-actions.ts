"use server";

import { redirect } from "next/navigation";

import { correctSupplyRequest } from "./correction-persistence";
import {
  SupplyRequestCorrectionError,
  unexpectedSupplyRequestCorrectionError,
} from "./correction-errors";
import {
  correctionSubmittedValues,
  parseCorrectSupplyRequestFormData,
  parseSupplyRequestCorrectionItems,
} from "./correction-surface-validation";
import type {
  SupplyRequestCorrectionActionState,
  SupplyRequestSelectedItemInput,
} from "./surface-types";

function recoveredItems(formData: FormData): SupplyRequestSelectedItemInput[] {
  try {
    return parseSupplyRequestCorrectionItems(formData.get("itemsPayload"));
  } catch {
    return [];
  }
}

function errorState(
  error: unknown,
  formData: FormData,
): SupplyRequestCorrectionActionState {
  const safe =
    error instanceof SupplyRequestCorrectionError
      ? error
      : unexpectedSupplyRequestCorrectionError();
  const source =
    safe.fieldErrors ??
    (safe.field ? { [safe.field]: [safe.message] } : {});
  const fieldErrors: Record<string, string[]> = {};
  Object.entries(source).forEach(([field, messages]) => {
    const mapped = field.startsWith("items.") ? "items" : field;
    fieldErrors[mapped] = [...(fieldErrors[mapped] ?? []), ...messages];
  });
  return {
    status: "error",
    message: safe.message,
    fieldErrors,
    values: correctionSubmittedValues(formData),
    items: recoveredItems(formData),
  };
}

export async function correctSupplyRequestAction(
  supplyRequestId: string,
  _previousState: SupplyRequestCorrectionActionState,
  formData: FormData,
) {
  let completedId: string;
  try {
    const parsed = parseCorrectSupplyRequestFormData(
      supplyRequestId,
      formData,
    );
    const result = await correctSupplyRequest(parsed.input);
    completedId = result.supplyRequestId;
  } catch (error) {
    return errorState(error, formData);
  }
  redirect(`/supply-requests/${encodeURIComponent(completedId)}`);
}
