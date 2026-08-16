import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWorkScheduleFormOptions } from "@/features/work-schedule/data";

const mocks = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  equipmentFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findMany: mocks.employeeFindMany },
    equipment: { findMany: mocks.equipmentFindMany },
  },
}));

describe("Work Schedule Employee options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.equipmentFindMany.mockResolvedValue([]);
  });

  it("loads active employees and limits Assigned By to supervisors", async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: "employee_911601", employeeCode: "911601", displayName: "Alain Alemany Arana", isActive: true, isSupervisor: false },
      { id: "supervisor-1", employeeCode: null, displayName: "Sam Supervisor", isActive: true, isSupervisor: true },
    ]);

    const options = await getWorkScheduleFormOptions();

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ isActive: true }] },
    }));
    expect(options.employeeOptions.map((option) => option.id)).toEqual([
      "employee_911601",
      "supervisor-1",
    ]);
    expect(options.supervisorOptions.map((option) => option.id)).toEqual(["supervisor-1"]);
    expect(options.defaultPrimaryEmployeeId).toBe("employee_911601");
  });

  it("requests referenced inactive employees for edit compatibility", async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: "inactive-1", employeeCode: "300", displayName: "Inactive Employee", isActive: false, isSupervisor: false },
    ]);

    const options = await getWorkScheduleFormOptions(["inactive-1"]);

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ isActive: true }, { id: { in: ["inactive-1"] } }] },
    }));
    expect(options.employeeOptions[0]).toMatchObject({
      id: "inactive-1",
      isActive: false,
      label: "Inactive Employee (300) — Inactive",
    });
  });
});
