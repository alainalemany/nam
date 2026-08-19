"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import {
  emptyLakeFormState,
  lakeFieldErrors,
  lakeFormSchema,
  type LakeFormState,
  type LakeFormValues,
} from "./lake-validation";

class LakePersistenceError extends Error {
  constructor(message: string, readonly field: keyof LakeFormValues) {
    super(message);
  }
}

function valuesFromForm(formData: FormData): LakeFormValues {
  const value = (name: string) => {
    const result = formData.get(name);
    return typeof result === "string" ? result : "";
  };
  return {
    mineId: value("mineId"),
    name: value("name"),
    status: value("status") as LakeFormValues["status"],
    notes: value("notes"),
  };
}

function parseLake(formData: FormData) {
  const values = valuesFromForm(formData);
  const parsed = lakeFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false as const,
      state: {
        status: "error" as const,
        message: "Check the highlighted Lake fields and try again.",
        fieldErrors: lakeFieldErrors(parsed.error),
        values,
      },
    };
  }
  return { ok: true as const, data: parsed.data, values };
}

function errorState(error: unknown, values: LakeFormValues): LakeFormState {
  if (error instanceof LakePersistenceError) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: { [error.field]: [error.message] },
      values,
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      status: "error",
      message: "That Lake name already exists for the selected Mine.",
      fieldErrors: { name: ["Enter a unique Lake name for this Mine."] },
      values,
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return {
      status: "error",
      message: "The requested Mine or Lake could not be found.",
      fieldErrors: {},
      values,
    };
  }
  return {
    ...emptyLakeFormState,
    status: "error",
    message: "The Lake could not be saved. Review the fields and try again.",
    values,
  };
}

function revalidateLakeSurfaces() {
  revalidatePath("/dragline-delay-reports/lakes");
  revalidatePath("/dragline-delay-reports/new");
  revalidatePath("/dragline-delay-reports");
}

export async function createLakeAction(
  _previousState: LakeFormState,
  formData: FormData,
) {
  const parsed = parseLake(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await prisma.$transaction(async (transaction) => {
      const mine = await transaction.mine.findUnique({
        where: { id: parsed.data.mineId },
      });
      if (!mine || mine.status !== "ACTIVE") {
        throw new LakePersistenceError("Select an active Mine.", "mineId");
      }
      await transaction.lake.create({
        data: {
          mineId: parsed.data.mineId,
          name: parsed.data.name,
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
        },
      });
    });
  } catch (error) {
    return errorState(error, parsed.values);
  }
  revalidateLakeSurfaces();
  redirect("/dragline-delay-reports/lakes?saved=created");
}

export async function updateLakeAction(
  id: string,
  _previousState: LakeFormState,
  formData: FormData,
) {
  const parsed = parseLake(formData);
  if (!parsed.ok) return parsed.state;
  try {
    await prisma.$transaction(async (transaction) => {
      const [existing, mine] = await Promise.all([
        transaction.lake.findUnique({
          where: { id },
          include: { _count: { select: { draglineDelayReports: true } } },
        }),
        transaction.mine.findUnique({ where: { id: parsed.data.mineId } }),
      ]);
      if (!existing) {
        throw new LakePersistenceError("The Lake could not be found.", "name");
      }
      if (!mine || (mine.status !== "ACTIVE" && existing.mineId !== mine.id)) {
        throw new LakePersistenceError("Select an active Mine.", "mineId");
      }
      if (
        existing.mineId !== parsed.data.mineId &&
        existing._count.draglineDelayReports > 0
      ) {
        throw new LakePersistenceError(
          "A Lake used by a report cannot be moved to another Mine.",
          "mineId",
        );
      }
      await transaction.lake.update({
        where: { id },
        data: {
          mineId: parsed.data.mineId,
          name: parsed.data.name,
          status: parsed.data.status,
          notes: parsed.data.notes ?? null,
        },
      });
    });
  } catch (error) {
    return errorState(error, parsed.values);
  }
  revalidateLakeSurfaces();
  redirect("/dragline-delay-reports/lakes?saved=updated");
}
