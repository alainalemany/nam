"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SupplyRequestDailyLogLinkActionState } from "./daily-log-link-action-state";
import {
  SupplyRequestDailyLogLinkError,
  unexpectedSupplyRequestDailyLogLinkError,
} from "./daily-log-link-errors";
import {
  removeSupplyRequestDailyLogLink,
  setSupplyRequestDailyLogLink,
} from "./daily-log-link-persistence";
import type { SupplyRequestDailyLogRoleValue } from "./daily-log-link-types";

const setFields = new Set([
  "dailyLogActivityId",
  "expectedDailyLogActivityId",
]);
const removeFields = new Set(["expectedDailyLogActivityId"]);

function rolePath(supplyRequestId: string, role: SupplyRequestDailyLogRoleValue) {
  return `/supply-requests/${encodeURIComponent(supplyRequestId)}/daily-log/${
    role === "SUBMISSION" ? "submission" : "fulfillment"
  }`;
}

function strictValue(
  formData: FormData,
  field: string,
  required: boolean,
) {
  const values = formData.getAll(field);
  if (values.length > 1) {
    throw new SupplyRequestDailyLogLinkError(
      "INVALID_INPUT",
      "The Daily Log link form contained repeated fields. Reload and try again.",
      field,
    );
  }
  if (values.length === 0) {
    if (!required) return undefined;
    throw new SupplyRequestDailyLogLinkError(
      "INVALID_INPUT",
      "Choose a Daily Log Activity.",
      field,
    );
  }
  const value = values[0];
  if (typeof value !== "string") {
    throw new SupplyRequestDailyLogLinkError(
      "INVALID_INPUT",
      "The Daily Log link form was invalid. Reload and try again.",
      field,
    );
  }
  const trimmed = value.trim();
  if (!trimmed && !required) return undefined;
  return trimmed;
}

function rejectUnknownFields(formData: FormData, allowed: ReadonlySet<string>) {
  for (const key of formData.keys()) {
    if (!allowed.has(key) && !key.startsWith("$ACTION_")) {
      throw new SupplyRequestDailyLogLinkError(
        "INVALID_INPUT",
        "The Daily Log link form contained an unsupported field. Reload and try again.",
      );
    }
  }
}

function errorState(
  error: unknown,
  selectedActivityId = "",
): SupplyRequestDailyLogLinkActionState {
  const safe =
    error instanceof SupplyRequestDailyLogLinkError
      ? error
      : unexpectedSupplyRequestDailyLogLinkError();
  return {
    status: "error",
    message: safe.message,
    fieldErrors:
      safe.fieldErrors ??
      (safe.field ? { [safe.field]: [safe.message] } : {}),
    selectedActivityId,
  };
}

function revalidateLinkPaths(
  supplyRequestId: string,
  role: SupplyRequestDailyLogRoleValue,
) {
  revalidatePath(`/supply-requests/${encodeURIComponent(supplyRequestId)}`);
  revalidatePath(rolePath(supplyRequestId, role));
  revalidatePath("/daily-logs");
}

export async function setSupplyRequestDailyLogLinkAction(
  supplyRequestId: string,
  role: SupplyRequestDailyLogRoleValue,
  _previousState: SupplyRequestDailyLogLinkActionState,
  formData: FormData,
): Promise<SupplyRequestDailyLogLinkActionState> {
  let selectedActivityId = "";
  try {
    rejectUnknownFields(formData, setFields);
    selectedActivityId = strictValue(
      formData,
      "dailyLogActivityId",
      true,
    )!;
    const expectedDailyLogActivityId = strictValue(
      formData,
      "expectedDailyLogActivityId",
      false,
    );
    await setSupplyRequestDailyLogLink({
      supplyRequestId,
      role,
      dailyLogActivityId: selectedActivityId,
      ...(expectedDailyLogActivityId
        ? { expectedDailyLogActivityId }
        : {}),
    });
  } catch (error) {
    return errorState(error, selectedActivityId);
  }

  revalidateLinkPaths(supplyRequestId, role);
  redirect(rolePath(supplyRequestId, role));
}

export async function removeSupplyRequestDailyLogLinkAction(
  supplyRequestId: string,
  role: SupplyRequestDailyLogRoleValue,
  _previousState: SupplyRequestDailyLogLinkActionState,
  formData: FormData,
): Promise<SupplyRequestDailyLogLinkActionState> {
  try {
    rejectUnknownFields(formData, removeFields);
    const expectedDailyLogActivityId = strictValue(
      formData,
      "expectedDailyLogActivityId",
      true,
    )!;
    await removeSupplyRequestDailyLogLink({
      supplyRequestId,
      role,
      expectedDailyLogActivityId,
    });
  } catch (error) {
    return errorState(error);
  }

  revalidateLinkPaths(supplyRequestId, role);
  redirect(rolePath(supplyRequestId, role));
}
