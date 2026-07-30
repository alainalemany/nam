"use server";

import { redirect } from "next/navigation";

import type { SupplyRequestLifecycleActionState } from "./lifecycle-action-state";
import {
  SupplyRequestLifecycleError,
  unexpectedSupplyRequestLifecycleError,
} from "./lifecycle-errors";
import {
  cancelSupplyRequest,
  fulfillSupplyRequest,
} from "./lifecycle-persistence";
import {
  lifecycleSubmittedValues,
  parseCancelSupplyRequestFormData,
  parseFulfillSupplyRequestFormData,
} from "./lifecycle-surface-validation";

function errorState(
  error: unknown,
  formData: FormData,
): SupplyRequestLifecycleActionState {
  const safe =
    error instanceof SupplyRequestLifecycleError
      ? error
      : unexpectedSupplyRequestLifecycleError();
  return {
    status: "error",
    message: safe.message,
    fieldErrors:
      safe.fieldErrors ??
      (safe.field ? { [safe.field]: [safe.message] } : {}),
    values: lifecycleSubmittedValues(formData),
  };
}

export async function fulfillSupplyRequestAction(
  supplyRequestId: string,
  _previousState: SupplyRequestLifecycleActionState,
  formData: FormData,
) {
  let completedId: string;
  try {
    const input = parseFulfillSupplyRequestFormData(
      supplyRequestId,
      formData,
    );
    const result = await fulfillSupplyRequest(input);
    completedId = result.supplyRequestId;
  } catch (error) {
    return errorState(error, formData);
  }

  redirect(`/supply-requests/${encodeURIComponent(completedId)}`);
}

export async function cancelSupplyRequestAction(
  supplyRequestId: string,
  _previousState: SupplyRequestLifecycleActionState,
  formData: FormData,
) {
  let completedId: string;
  try {
    const input = parseCancelSupplyRequestFormData(supplyRequestId, formData);
    const result = await cancelSupplyRequest(input);
    completedId = result.supplyRequestId;
  } catch (error) {
    return errorState(error, formData);
  }

  redirect(`/supply-requests/${encodeURIComponent(completedId)}`);
}
