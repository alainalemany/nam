"use server";

import { redirect } from "next/navigation";

import { SupplyRequestCreateError } from "./errors";
import { createSupplyRequest } from "./persistence";
import {
  searchActiveSupplyRequestEquipment,
  searchActiveSupplyRequestItems,
  searchActiveSupplyRequestSupervisors,
} from "./surface-data";
import type {
  SupplyRequestCreateActionState,
  SupplyRequestCreateFormValues,
  SupplyRequestSearchResult,
  SupplyRequestSelectedItemInput,
} from "./surface-types";
import {
  parseSupplyRequestCreateFormData,
  parseSupplyRequestSearchQuery,
  parseSupplyRequestSelectedItemsPayload,
  supplyRequestCreateFormValues,
} from "./surface-validation";

function recoveredItems(formData: FormData) {
  const value = formData.get("itemsPayload");
  try {
    return parseSupplyRequestSelectedItemsPayload(value);
  } catch {
    return [];
  }
}

function errorState(
  error: unknown,
  values: SupplyRequestCreateFormValues,
  items: readonly SupplyRequestSelectedItemInput[],
): SupplyRequestCreateActionState {
  const safe =
    error instanceof SupplyRequestCreateError
      ? error
      : new SupplyRequestCreateError(
          "UNEXPECTED_PERSISTENCE",
          "The submitted request could not be recorded in NAM. Try again.",
        );
  const sourceFieldErrors =
    safe.fieldErrors ??
    (safe.field ? { [safe.field]: [safe.message] } : ({} as const));
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(sourceFieldErrors)) {
    const surfaceField = field.startsWith("items.") ? "items" : field;
    fieldErrors[surfaceField] = [
      ...(fieldErrors[surfaceField] ?? []),
      ...messages,
    ];
  }
  return {
    status: "error",
    message: safe.message,
    fieldErrors,
    values,
    items,
  };
}

async function safeSearch<T>(
  input: unknown,
  search: (query: string) => Promise<readonly T[]>,
): Promise<SupplyRequestSearchResult<T>> {
  const query = parseSupplyRequestSearchQuery(input);
  if (query === null) {
    return {
      options: [],
      error: "Search text must be 200 characters or fewer.",
    };
  }
  try {
    return { options: await search(query), error: null };
  } catch {
    return {
      options: [],
      error: "Search is temporarily unavailable. Try again.",
    };
  }
}

export async function searchSupplyRequestEquipmentAction(input: unknown) {
  return safeSearch(input, searchActiveSupplyRequestEquipment);
}

export async function searchSupplyRequestSupervisorsAction(input: unknown) {
  return safeSearch(input, searchActiveSupplyRequestSupervisors);
}

export async function searchSupplyRequestItemsAction(input: unknown) {
  return safeSearch(input, searchActiveSupplyRequestItems);
}

export async function createSupplyRequestAction(
  _previousState: SupplyRequestCreateActionState,
  formData: FormData,
) {
  const values = supplyRequestCreateFormValues(formData);
  const items = recoveredItems(formData);
  let created: Awaited<ReturnType<typeof createSupplyRequest>>;
  try {
    const parsed = parseSupplyRequestCreateFormData(formData);
    created = await createSupplyRequest(parsed.input);
  } catch (error) {
    return errorState(error, values, items);
  }

  redirect(
    `/supply-requests/${encodeURIComponent(created.supplyRequestId)}`,
  );
}
