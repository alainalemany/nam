"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  SupplyRequestReferenceError,
  unexpectedSupplyRequestReferenceError,
} from "./reference-errors";
import type { ReferenceActionState } from "./reference-action-state";
import {
  createSupervisorReference,
  createSupplyItemReference,
  setSupervisorStatus,
  setSupplyItemStatus,
  updateSupervisorReference,
  updateSupplyItemReference,
} from "./reference-persistence";

function value(formData: FormData, field: string) {
  const entry = formData.get(field);
  return typeof entry === "string" ? entry : "";
}

function assertExpectedFormFields(
  formData: FormData,
  expectedFields: readonly string[],
) {
  const expected = new Set(expectedFields);
  const counts = new Map<string, number>();
  for (const key of formData.keys()) {
    if (key.startsWith("$ACTION_")) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unexpected = [...counts].some(
    ([key, count]) => !expected.has(key) || count !== 1,
  );
  if (unexpected) {
    throw new SupplyRequestReferenceError(
      "INVALID_INPUT",
      "Check the reference details before saving.",
      "form",
      { form: ["The submitted form contained unexpected fields."] },
    );
  }
}

function errorState(
  error: unknown,
  values: Readonly<Record<string, string>>,
): ReferenceActionState {
  const safe =
    error instanceof SupplyRequestReferenceError
      ? error
      : unexpectedSupplyRequestReferenceError();
  return {
    status: "error",
    message: safe.message,
    fieldErrors: safe.fieldErrors ?? {},
    values,
  };
}

function supplyItemValues(formData: FormData) {
  return {
    itemNumber: value(formData, "itemNumber"),
    description: value(formData, "description"),
    unitOfMeasure: value(formData, "unitOfMeasure"),
  };
}

function supervisorValues(formData: FormData) {
  return {
    fullName: value(formData, "fullName"),
    email: value(formData, "email"),
  };
}

export async function createSupplyItemReferenceAction(
  _previousState: ReferenceActionState,
  formData: FormData,
) {
  const values = supplyItemValues(formData);
  try {
    assertExpectedFormFields(formData, [
      "itemNumber",
      "description",
      "unitOfMeasure",
    ]);
    await createSupplyItemReference(values);
  } catch (error) {
    return errorState(error, values);
  }
  revalidatePath("/supply-requests/items");
  redirect("/supply-requests/items");
}

export async function updateSupplyItemReferenceAction(
  id: string,
  _previousState: ReferenceActionState,
  formData: FormData,
) {
  const values = supplyItemValues(formData);
  try {
    assertExpectedFormFields(formData, [
      "itemNumber",
      "description",
      "unitOfMeasure",
    ]);
    await updateSupplyItemReference(id, values);
  } catch (error) {
    return errorState(error, values);
  }
  revalidatePath("/supply-requests/items");
  revalidatePath(`/supply-requests/items/${id}/edit`);
  redirect("/supply-requests/items");
}

export async function changeSupplyItemStatusAction(
  id: string,
  intent: string,
  _previousState: ReferenceActionState,
  _formData: FormData,
) {
  try {
    assertExpectedFormFields(_formData, []);
    await setSupplyItemStatus(id, intent);
  } catch (error) {
    return errorState(error, {});
  }
  revalidatePath("/supply-requests/items");
  revalidatePath(`/supply-requests/items/${id}/edit`);
  redirect("/supply-requests/items");
}

export async function createSupervisorReferenceAction(
  _previousState: ReferenceActionState,
  formData: FormData,
) {
  const values = supervisorValues(formData);
  try {
    assertExpectedFormFields(formData, ["fullName", "email"]);
    await createSupervisorReference(values);
  } catch (error) {
    return errorState(error, values);
  }
  revalidatePath("/supply-requests/supervisors");
  redirect("/supply-requests/supervisors");
}

export async function updateSupervisorReferenceAction(
  id: string,
  _previousState: ReferenceActionState,
  formData: FormData,
) {
  const values = supervisorValues(formData);
  try {
    assertExpectedFormFields(formData, ["fullName", "email"]);
    await updateSupervisorReference(id, values);
  } catch (error) {
    return errorState(error, values);
  }
  revalidatePath("/supply-requests/supervisors");
  revalidatePath(`/supply-requests/supervisors/${id}/edit`);
  redirect("/supply-requests/supervisors");
}

export async function changeSupervisorStatusAction(
  id: string,
  intent: string,
  _previousState: ReferenceActionState,
  _formData: FormData,
) {
  try {
    assertExpectedFormFields(_formData, []);
    await setSupervisorStatus(id, intent);
  } catch (error) {
    return errorState(error, {});
  }
  revalidatePath("/supply-requests/supervisors");
  revalidatePath(`/supply-requests/supervisors/${id}/edit`);
  redirect("/supply-requests/supervisors");
}
