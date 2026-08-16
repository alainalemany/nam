"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { emptyEmployeeFormState, type EmployeeFormState, type EmployeeFormValues } from "./types";
import { employeeFieldErrors, employeeFormSchema } from "./validation";

function formValues(formData: FormData): EmployeeFormValues {
  const displayName = formData.get("displayName");
  const employeeCode = formData.get("employeeCode");
  return {
    displayName: typeof displayName === "string" ? displayName : "",
    employeeCode: typeof employeeCode === "string" ? employeeCode : "",
    isActive: formData.get("isActive") === "on",
    isSupervisor: formData.get("isSupervisor") === "on",
  };
}

function parseEmployeeForm(formData: FormData):
  | { ok: true; data: ReturnType<typeof employeeFormSchema.parse>; values: EmployeeFormValues }
  | { ok: false; state: EmployeeFormState } {
  const values = formValues(formData);
  const parsed = employeeFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "Check the highlighted Employee fields and try again.",
        fieldErrors: employeeFieldErrors(parsed.error),
        values,
      },
    };
  }
  return { ok: true, data: parsed.data, values };
}

function persistenceErrorState(error: unknown, values: EmployeeFormValues): EmployeeFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      status: "error",
      message: "That Employee Code is already assigned to another employee.",
      fieldErrors: { employeeCode: ["Enter a unique Employee Code or leave it blank."] },
      values,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return {
      status: "error",
      message: "The requested Employee could not be found.",
      fieldErrors: {},
      values,
    };
  }

  return {
    ...emptyEmployeeFormState,
    status: "error",
    message: "Employee could not be saved. Review the fields and try again.",
    values,
  };
}

function employeeWriteData(data: ReturnType<typeof employeeFormSchema.parse>) {
  return {
    displayName: data.displayName,
    employeeCode: data.employeeCode ?? null,
    isActive: data.isActive,
    isSupervisor: data.isSupervisor,
  };
}

function revalidateEmployeeSurfaces(id?: string) {
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  if (id) revalidatePath(`/employees/${id}/edit`);
  revalidatePath("/work-schedule/new");
  revalidatePath("/work-schedule");
}

export async function createEmployeeAction(
  _previousState: EmployeeFormState,
  formData: FormData,
) {
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) return parsed.state;

  try {
    await prisma.employee.create({ data: employeeWriteData(parsed.data) });
  } catch (error) {
    return persistenceErrorState(error, parsed.values);
  }

  revalidateEmployeeSurfaces();
  redirect("/employees");
}

export async function updateEmployeeAction(
  id: string,
  _previousState: EmployeeFormState,
  formData: FormData,
) {
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) return parsed.state;

  try {
    await prisma.employee.update({
      where: { id },
      data: employeeWriteData(parsed.data),
    });
  } catch (error) {
    return persistenceErrorState(error, parsed.values);
  }

  revalidateEmployeeSurfaces(id);
  redirect("/employees");
}
