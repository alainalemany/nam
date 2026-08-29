"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCitySelectorOptions } from "./data";
import { GeographyPersistenceError, saveCity, saveState, setCityStatus, setStateStatus } from "./persistence";
import {
  citySubmissionSchema,
  geographyFieldErrors,
  type GeographyActionState,
  stateSubmissionSchema,
} from "./validation";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(error: unknown, values: Record<string, string>): GeographyActionState {
  if (error instanceof GeographyPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
      values,
    };
  }
  return { status: "error", message: "Reference data could not be saved. Try again.", fieldErrors: {}, values };
}

function revalidateGeography() {
  revalidatePath("/reference-data");
  revalidatePath("/reference-data/states");
  revalidatePath("/reference-data/cities");
  revalidatePath("/equipment-fuel-events/gas-stations");
  revalidatePath("/equipment");
}

async function submitState(id: string | undefined, formData: FormData) {
  const values = { name: field(formData, "name"), abbreviation: field(formData, "abbreviation") };
  const parsed = stateSubmissionSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error" as const, message: "Check the highlighted State fields.", fieldErrors: geographyFieldErrors(parsed.error), values };
  }
  try { await saveState(parsed.data, id); } catch (error) { return failure(error, values); }
  revalidateGeography();
  redirect("/reference-data/states");
}

async function submitCity(id: string | undefined, formData: FormData) {
  const values = { name: field(formData, "name"), stateId: field(formData, "stateId") };
  const parsed = citySubmissionSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error" as const, message: "Check the highlighted City fields.", fieldErrors: geographyFieldErrors(parsed.error), values };
  }
  try { await saveCity(parsed.data, id); } catch (error) { return failure(error, values); }
  revalidateGeography();
  redirect("/reference-data/cities");
}

export async function createStateAction(_state: GeographyActionState, formData: FormData) { return submitState(undefined, formData); }
export async function updateStateAction(id: string, _state: GeographyActionState, formData: FormData) { return submitState(id, formData); }
export async function createCityAction(_state: GeographyActionState, formData: FormData) { return submitCity(undefined, formData); }
export async function updateCityAction(id: string, _state: GeographyActionState, formData: FormData) { return submitCity(id, formData); }

export async function changeStateStatusAction(id: string, active: boolean, _state: GeographyActionState, _formData: FormData) {
  try { await setStateStatus(id, active); } catch (error) { return failure(error, {}); }
  revalidateGeography();
  redirect("/reference-data/states");
}

export async function changeCityStatusAction(id: string, active: boolean, _state: GeographyActionState, _formData: FormData) {
  try { await setCityStatus(id, active); } catch (error) { return failure(error, {}); }
  revalidateGeography();
  redirect("/reference-data/cities");
}

export async function searchCityOptionsAction(query: string, selectedCityId?: string | null) {
  const normalizedQuery = query.trim().slice(0, 200);
  if (normalizedQuery.length < 2) return getCitySelectorOptions({ selectedCityId });
  return getCitySelectorOptions({ query: normalizedQuery, selectedCityId, limit: 50 });
}
