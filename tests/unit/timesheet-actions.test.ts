import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  completeWeeklyTimesheetAction,
  deleteWeeklyTimesheetAction,
  reopenWeeklyTimesheetAction,
  saveWeeklyTimesheetAction,
  saveWorkCodeAction,
} from "@/features/timesheets/actions";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), weeklyFind: vi.fn(), weeklyCreate: vi.fn(), weeklyUpdate: vi.fn(), weeklyUpdateMany: vi.fn(),
  weeklyDeleteMany: vi.fn(),
  equipmentFind: vi.fn(), workCodeFind: vi.fn(), workOrderFind: vi.fn(), supportFind: vi.fn(), assignmentFind: vi.fn(),
  entryUpsert: vi.fn(), entryDeleteMany: vi.fn(), allocationUpsert: vi.fn(), allocationDeleteMany: vi.fn(),
  supportDeleteMany: vi.fn(), supportUpsert: vi.fn(), workCodeUpdateMany: vi.fn(), workOrderUpdateMany: vi.fn(), supportUpdateMany: vi.fn(),
  workCodeCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((href: string) => { throw new Error(`redirect:${href}`); }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    weeklyTimesheet: { updateMany: mocks.weeklyUpdateMany, deleteMany: mocks.weeklyDeleteMany },
    timesheetWorkCode: { create: mocks.workCodeCreate },
  },
}));

const equipment = { id: "equipment-1", displayName: "Dragline 1", equipmentNumber: "DL-1", category: "DRAGLINE", mine: { name: "North Mine", city: { name: "Gillette", state: "WY" } } };
const workCode = { id: "code-1", code: "P-137", description: "Production", active: true };
const workOrder = { id: "order-1", workOrderNumber: "WO-1", description: "Repair", active: true };
const supportPerson = { id: "person-1", displayName: "Pat Smith", tradeOrRole: "Mechanic", company: "ACME", active: true };

function payload() {
  return {
    payrollWeekStartDate: "2026-07-13",
    primaryEmployeeDisplayName: "  Alex   Operator ",
    entries: [{
      workDate: "2026-07-13", clockIn: "07:00", clockOut: "19:00", unpaidBreakMinutes: 30,
      primaryEquipmentId: "equipment-1", workScheduleDailyAssignmentId: "", notes: "Production",
      allocations: [{ sequence: 1, workCodeId: "code-1", workOrderId: "order-1", allocatedMinutes: 690, supportPersonIds: ["person-1"], notes: "Repair then production" }],
    }],
  };
}

function formData() {
  const data = new FormData();
  data.set("payload", JSON.stringify(payload()));
  return data;
}

function formDataWith(update: (value: ReturnType<typeof payload>) => void) {
  const value = payload();
  update(value);
  const data = new FormData();
  data.set("payload", JSON.stringify(value));
  return data;
}

function tx() {
  return {
    weeklyTimesheet: { findUnique: mocks.weeklyFind, create: mocks.weeklyCreate, update: mocks.weeklyUpdate },
    equipment: { findMany: mocks.equipmentFind },
    timesheetWorkCode: { findMany: mocks.workCodeFind, updateMany: mocks.workCodeUpdateMany },
    timesheetWorkOrder: { findMany: mocks.workOrderFind, updateMany: mocks.workOrderUpdateMany },
    timesheetSupportPerson: { findMany: mocks.supportFind, updateMany: mocks.supportUpdateMany },
    dailyAssignment: { findMany: mocks.assignmentFind },
    dailyTimeEntry: { upsert: mocks.entryUpsert, deleteMany: mocks.entryDeleteMany },
    workAllocation: { upsert: mocks.allocationUpsert, deleteMany: mocks.allocationDeleteMany },
    workAllocationSupportPerson: { deleteMany: mocks.supportDeleteMany, upsert: mocks.supportUpsert },
  };
}

describe("Timesheet Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback(tx()));
    mocks.weeklyFind.mockResolvedValue(null);
    mocks.weeklyCreate.mockResolvedValue({ id: "timesheet-1" });
    mocks.weeklyUpdate.mockResolvedValue({ id: "timesheet-1" });
    mocks.equipmentFind.mockResolvedValue([equipment]);
    mocks.workCodeFind.mockResolvedValue([workCode]);
    mocks.workOrderFind.mockResolvedValue([workOrder]);
    mocks.supportFind.mockResolvedValue([supportPerson]);
    mocks.assignmentFind.mockResolvedValue([]);
    mocks.entryUpsert.mockResolvedValue({ id: "entry-1" });
    mocks.allocationUpsert.mockResolvedValue({ id: "allocation-1" });
    mocks.entryDeleteMany.mockResolvedValue({ count: 0 });
    mocks.allocationDeleteMany.mockResolvedValue({ count: 0 });
    mocks.supportDeleteMany.mockResolvedValue({ count: 0 });
    mocks.workCodeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.workOrderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.supportUpdateMany.mockResolvedValue({ count: 1 });
    mocks.weeklyDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("creates the first-use parent and all children in one transaction", async () => {
    await expect(saveWeeklyTimesheetAction(null, { status: "idle", message: "", fieldErrors: {} }, formData())).rejects.toThrow("redirect:/timesheets/timesheet-1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.weeklyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ primaryEmployeeDisplayName: "Alex   Operator", primaryEmployeeKey: "alex operator" }) });
    expect(mocks.entryUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ workedMinutes: 690, primaryEquipmentDisplayNameSnapshot: "Dragline 1" }) }));
    expect(mocks.allocationUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ workCodeSnapshot: "P-137", workOrderSnapshot: "WO-1", allocatedMinutes: 690 }) }));
    expect(mocks.supportUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ supportPersonDisplayNameSnapshot: "Pat Smith" }) }));
  });

  it("returns completion feedback when allocations do not reconcile", async () => {
    mocks.weeklyFind.mockResolvedValue({ id: "timesheet-1", status: "DRAFT", entries: [{ workedMinutes: 690, allocations: [{ allocatedMinutes: 600 }] }] });
    const result = await completeWeeklyTimesheetAction("timesheet-1", { ok: true, message: "" }, new FormData());
    expect(result).toMatchObject({ ok: false });
    expect(mocks.weeklyUpdate).not.toHaveBeenCalled();
  });

  it("completes a reconciled Draft and supports explicit reopen", async () => {
    mocks.weeklyFind.mockResolvedValue({ id: "timesheet-1", status: "DRAFT", entries: [{ workedMinutes: 690, allocations: [{ allocatedMinutes: 690 }] }] });
    await expect(completeWeeklyTimesheetAction("timesheet-1", { ok: true, message: "" }, new FormData())).rejects.toThrow("redirect:/timesheets/timesheet-1");
    expect(mocks.weeklyUpdate).toHaveBeenCalledWith({ where: { id: "timesheet-1" }, data: { status: "COMPLETED" } });

    mocks.weeklyUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reopenWeeklyTimesheetAction("timesheet-1")).rejects.toThrow("redirect:/timesheets/timesheet-1/edit");
    expect(mocks.weeklyUpdateMany).toHaveBeenCalledWith({ where: { id: "timesheet-1", status: "COMPLETED" }, data: { status: "DRAFT" } });
  });

  it("normalizes Work Code uniqueness in reference management", async () => {
    mocks.workCodeCreate.mockResolvedValue({ id: "code-1" });
    const data = new FormData();
    data.set("code", " p-137 "); data.set("description", "Production"); data.set("category", "Production"); data.set("equipmentId", ""); data.set("active", "on");
    const result = await saveWorkCodeAction(null, { ok: true, message: "" }, data);
    expect(result).toEqual({ ok: true, message: "Work Code saved." });
    expect(mocks.workCodeCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ normalizedCode: "P-137", active: true }) });
  });

  it("accepts matching-owner Work Schedule context with the same work date", async () => {
    mocks.assignmentFind.mockResolvedValue([{
      id: "assignment-1",
      assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
      weeklySchedule: { primaryEmployeeKey: "alex operator" },
    }]);
    const data = formDataWith((value) => {
      value.entries[0].workScheduleDailyAssignmentId = "assignment-1";
    });

    await expect(
      saveWeeklyTimesheetAction(null, { status: "idle", message: "", fieldErrors: {} }, data),
    ).rejects.toThrow("redirect:/timesheets/timesheet-1");
  });

  it("rejects Work Schedule context owned by another employee", async () => {
    mocks.assignmentFind.mockResolvedValue([{
      id: "assignment-1",
      assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
      weeklySchedule: { primaryEmployeeKey: "different operator" },
    }]);
    const data = formDataWith((value) => {
      value.entries[0].workScheduleDailyAssignmentId = "assignment-1";
    });

    const result = await saveWeeklyTimesheetAction(
      null,
      { status: "idle", message: "", fieldErrors: {} },
      data,
    );
    expect(result.message).toBe("Work Schedule context must belong to the same Timesheet employee.");
    expect(result.fieldErrors).toEqual({
      "entries.0.workScheduleDailyAssignmentId": [
        "Work Schedule context must belong to the same Timesheet employee.",
      ],
    });
  });

  it("rejects matching-owner Work Schedule context from another date", async () => {
    mocks.assignmentFind.mockResolvedValue([{
      id: "assignment-1",
      assignmentDate: new Date("2026-07-14T00:00:00.000Z"),
      weeklySchedule: { primaryEmployeeKey: "alex operator" },
    }]);
    const data = formDataWith((value) => {
      value.entries[0].workScheduleDailyAssignmentId = "assignment-1";
    });

    const result = await saveWeeklyTimesheetAction(
      null,
      { status: "idle", message: "", fieldErrors: {} },
      data,
    );
    expect(result.message).toBe("Work Schedule context must match the Daily Time Entry work date.");
  });

  it("rejects saves to Completed Timesheets", async () => {
    mocks.weeklyFind.mockResolvedValue({ id: "timesheet-1", status: "COMPLETED", entries: [] });
    const result = await saveWeeklyTimesheetAction(
      "timesheet-1",
      { status: "idle", message: "", fieldErrors: {} },
      formData(),
    );
    expect(result.message).toBe("Reopen this Completed Timesheet before editing it.");
    expect(mocks.entryUpsert).not.toHaveBeenCalled();
  });

  it("limits deletion to Draft Timesheets", async () => {
    await expect(deleteWeeklyTimesheetAction("timesheet-1")).rejects.toThrow("redirect:/timesheets");
    expect(mocks.weeklyDeleteMany).toHaveBeenCalledWith({
      where: { id: "timesheet-1", status: "DRAFT" },
    });
  });

  it("returns a safe owner/week uniqueness conflict", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "6.16.3",
      }),
    );
    const result = await saveWeeklyTimesheetAction(
      null,
      { status: "idle", message: "", fieldErrors: {} },
      formData(),
    );
    expect(result.message).toBe("A Timesheet already exists for this employee and payroll week.");
  });

  it.each([
    ["Work Code", () => mocks.workCodeFind.mockResolvedValue([{ ...workCode, active: false }]), "Inactive Work Codes cannot be selected for new allocations."],
    ["Work Order", () => mocks.workOrderFind.mockResolvedValue([{ ...workOrder, active: false }]), "Inactive Work Orders cannot be selected for new allocations."],
    ["Support Personnel", () => mocks.supportFind.mockResolvedValue([{ ...supportPerson, active: false }]), "Inactive Support Personnel cannot be selected for new allocations."],
  ])("rejects inactive %s records for new use", async (_label, arrange, message) => {
    arrange();
    const result = await saveWeeklyTimesheetAction(
      null,
      { status: "idle", message: "", fieldErrors: {} },
      formData(),
    );
    expect(result.message).toBe(message);
    expect(Object.keys(result.fieldErrors)[0]).toMatch(/^entries\.0\.allocations\.0\./);
  });
});
