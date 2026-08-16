import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmployeeAction, updateEmployeeAction } from "@/features/employees/actions";
import { emptyEmployeeFormState } from "@/features/employees/types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { employee: { create: mocks.create, update: mocks.update } },
}));

function employeeFormData({
  displayName = "Jordan Employee",
  employeeCode = "",
  isActive = true,
  isSupervisor = false,
} = {}) {
  const formData = new FormData();
  formData.set("displayName", displayName);
  formData.set("employeeCode", employeeCode);
  if (isActive) formData.set("isActive", "on");
  if (isSupervisor) formData.set("isSupervisor", "on");
  return formData;
}

describe("Employee actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: "employee-1" });
    mocks.update.mockResolvedValue({ id: "employee-1" });
  });

  it("creates an active non-supervisor with an optional null code", async () => {
    await expect(
      createEmployeeAction(emptyEmployeeFormState, employeeFormData()),
    ).rejects.toThrow("redirect:/employees");

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        displayName: "Jordan Employee",
        employeeCode: null,
        isActive: true,
        isSupervisor: false,
      },
    });
  });

  it("returns a field error when Employee Code is duplicated", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["employeeCode"] },
      }),
    );

    const result = await createEmployeeAction(
      emptyEmployeeFormState,
      employeeFormData({ employeeCode: "911601" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "That Employee Code is already assigned to another employee.",
      fieldErrors: { employeeCode: ["Enter a unique Employee Code or leave it blank."] },
    });
  });

  it("edits the Employee by stable ID without touching schedule snapshots", async () => {
    await expect(
      updateEmployeeAction(
        "employee-1",
        emptyEmployeeFormState,
        employeeFormData({
          displayName: "Jordan Supervisor",
          employeeCode: "200",
          isActive: false,
          isSupervisor: true,
        }),
      ),
    ).rejects.toThrow("redirect:/employees");

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "employee-1" },
      data: {
        displayName: "Jordan Supervisor",
        employeeCode: "200",
        isActive: false,
        isSupervisor: true,
      },
    });
  });
});
