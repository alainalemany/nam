"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyEquipmentFormState,
  equipmentFormSchema,
  type EquipmentFormInput,
  type EquipmentFormState,
} from "./validation";

function asNullable(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

async function findOrCreateCity(input: EquipmentFormInput) {
  const state = asNullable(input.cityState);

  const existingCity = await prisma.city.findFirst({
    where: {
      name: input.cityName,
      state,
    },
  });

  if (existingCity) {
    return existingCity;
  }

  return prisma.city.create({
    data: {
      name: input.cityName,
      state,
    },
  });
}

async function findOrCreateMine(input: EquipmentFormInput, cityId: string) {
  const existingMine = await prisma.mine.findFirst({
    where: {
      cityId,
      name: input.mineName,
    },
  });

  if (existingMine) {
    if (input.mineType && existingMine.type !== input.mineType) {
      return prisma.mine.update({
        where: { id: existingMine.id },
        data: { type: input.mineType },
      });
    }

    return existingMine;
  }

  return prisma.mine.create({
    data: {
      cityId,
      name: input.mineName,
      type: asNullable(input.mineType),
    },
  });
}

function duplicateMessage() {
  return {
    status: "error" as const,
    message: "An equipment record with this display name already exists for the selected mine.",
    fieldErrors: {
      displayName: ["Use a unique display name for this mine."],
    },
  };
}

function errorState(message: string): EquipmentFormState {
  return {
    ...emptyEquipmentFormState,
    status: "error",
    message,
  };
}

function parseFormData(formData: FormData):
  | { ok: true; data: EquipmentFormInput }
  | { ok: false; state: EquipmentFormState } {
  const parsed = equipmentFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the highlighted fields and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return { ok: true, data: parsed.data };
}

export async function createEquipmentAction(
  _previousState: EquipmentFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    const city = await findOrCreateCity(input.data);
    const mine = await findOrCreateMine(input.data, city.id);

    await prisma.equipment.create({
      data: {
        mineId: mine.id,
        displayName: input.data.displayName,
        equipmentNumber: asNullable(input.data.equipmentNumber),
        category: input.data.category,
        make: asNullable(input.data.make),
        model: asNullable(input.data.model),
        powerType: input.data.powerType || null,
        instrumentationType: input.data.instrumentationType || null,
        hasDigitalAlarmScreen: input.data.hasDigitalAlarmScreen,
        status: input.data.status,
        notes: asNullable(input.data.notes),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateMessage();
    }

    return errorState("Equipment could not be created. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  redirect("/equipment");
}

export async function updateEquipmentAction(
  equipmentId: string,
  _previousState: EquipmentFormState,
  formData: FormData,
) {
  const input = parseFormData(formData);

  if (!input.ok) {
    return input.state;
  }

  try {
    const city = await findOrCreateCity(input.data);
    const mine = await findOrCreateMine(input.data, city.id);

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        mineId: mine.id,
        displayName: input.data.displayName,
        equipmentNumber: asNullable(input.data.equipmentNumber),
        category: input.data.category,
        make: asNullable(input.data.make),
        model: asNullable(input.data.model),
        powerType: input.data.powerType || null,
        instrumentationType: input.data.instrumentationType || null,
        hasDigitalAlarmScreen: input.data.hasDigitalAlarmScreen,
        status: input.data.status,
        notes: asNullable(input.data.notes),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return duplicateMessage();
    }

    return errorState("Equipment could not be updated. Review the fields and try again.");
  }

  revalidatePath("/");
  revalidatePath("/equipment");
  revalidatePath(`/equipment/${equipmentId}/edit`);
  redirect("/equipment");
}
