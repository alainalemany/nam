"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { GasStationPersistenceError, saveGasStation, setGasStationActive } from "./gas-station-persistence";
import {
  gasStationFieldErrors,
  gasStationSubmissionSchema,
  type GasStationActionState,
} from "./gas-station-validation";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function values(formData: FormData) {
  return {
    name: field(formData, "name"),
    address: field(formData, "address"),
    cityId: field(formData, "cityId"),
    postalCode: field(formData, "postalCode"),
  };
}

function failure(error: unknown, submitted: ReturnType<typeof values>): GasStationActionState {
  if (error instanceof GasStationPersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error.field ? { [error.field]: [error.message] } : {},
      values: submitted,
    };
  }
  return {
    status: "error",
    message: "The Gas Station could not be saved. Review the fields and try again.",
    fieldErrors: {},
    values: submitted,
  };
}

async function submit(id: string | undefined, formData: FormData) {
  const submitted = values(formData);
  const parsed = gasStationSubmissionSchema.safeParse(submitted);
  if (!parsed.success) {
    return {
      status: "error" as const,
      message: "Check the highlighted Gas Station fields and try again.",
      fieldErrors: gasStationFieldErrors(parsed.error),
      values: submitted,
    };
  }
  try {
    await saveGasStation(parsed.data, id);
  } catch (error) {
    return failure(error, submitted);
  }
  revalidatePath("/equipment-fuel-events/gas-stations");
  revalidatePath("/equipment-fuel-events/new");
  if (id) revalidatePath(`/equipment-fuel-events/gas-stations/${id}/edit`);
  redirect("/equipment-fuel-events/gas-stations");
}

export async function createGasStationAction(
  _previousState: GasStationActionState,
  formData: FormData,
) {
  return submit(undefined, formData);
}

export async function updateGasStationAction(
  id: string,
  _previousState: GasStationActionState,
  formData: FormData,
) {
  return submit(id, formData);
}

export async function changeGasStationStatusAction(
  id: string,
  isActive: boolean,
  _previousState: GasStationActionState,
  _formData: FormData,
) {
  try {
    await setGasStationActive(id, isActive);
  } catch (error) {
    return failure(error, { name: "", address: "", cityId: "", postalCode: "" });
  }
  revalidatePath("/equipment-fuel-events/gas-stations");
  revalidatePath("/equipment-fuel-events/new");
  redirect("/equipment-fuel-events/gas-stations");
}
