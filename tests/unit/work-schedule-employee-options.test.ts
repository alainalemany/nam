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
    process.env.NAM_PAYROLL_OWNER_EMPLOYEE_ID = "configured-owner-id";
  });

  it("loads active employees and limits Assigned By to supervisors", async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: "configured-owner-id", employeeCode: "OWNER-001", displayName: "Configured Owner", isActive: true, isSupervisor: false },
      { id: "supervisor-1", employeeCode: null, displayName: "Sam Supervisor", isActive: true, isSupervisor: true },
    ]);

    const options = await getWorkScheduleFormOptions();

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ isActive: true }] },
    }));
    expect(options.employeeOptions.map((option) => option.id)).toEqual([
      "configured-owner-id",
      "supervisor-1",
    ]);
    expect(options.supervisorOptions.map((option) => option.id)).toEqual(["supervisor-1"]);
    expect(options.defaultPrimaryEmployeeId).toBe("configured-owner-id");
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

  it("does not guess an owner when the configured mapping is unavailable", async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: "employee-other", employeeCode: "200", displayName: "Other Employee", isActive: true, isSupervisor: false },
    ]);

    const options = await getWorkScheduleFormOptions();

    expect(options.defaultPrimaryEmployeeId).toBe("");
  });

  it("does not default an inactive configured owner", async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: "configured-owner-id", employeeCode: "OWNER-001", displayName: "Historical Owner", isActive: false, isSupervisor: false },
    ]);

    const options = await getWorkScheduleFormOptions(["configured-owner-id"]);

    expect(options.defaultPrimaryEmployeeId).toBe("");
  });
});
