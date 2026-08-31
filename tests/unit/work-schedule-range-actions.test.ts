import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  saveScheduleRangeAction,
} from "@/features/work-schedule/range-actions";
import { emptyScheduleRangeFormState } from "@/features/work-schedule/range-state";
import { buildDateRange, parseDateOnly } from "@/features/work-schedule/validation";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  scheduleFindMany: vi.fn(),
  scheduleCreate: vi.fn(),
  scheduleUpdate: vi.fn(),
  assignmentUpsert: vi.fn(),
  employeeFindMany: vi.fn(),
  equipmentFindMany: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

const employees = [
  { id: "employee-1", employeeCode: "100", displayName: "Alex Operator", isActive: true, isSupervisor: false },
  { id: "supervisor-1", employeeCode: "200", displayName: "Sam Supervisor", isActive: true, isSupervisor: true },
];
const equipment = {
  id: "equipment-1",
  displayName: "Dragline 7",
  equipmentNumber: "DL-7",
  category: "DRAGLINE",
  mine: { name: "North Mine", city: { name: "Gillette", state: "WY" } },
};

function rangeForm(overwrite = false) {
  const form = new FormData();
  form.set("startDate", "2026-08-31");
  form.set("endDate", "2026-09-08");
  form.set("status", "ACTIVE");
  form.set("primaryEmployeeId", "employee-1");
  form.set("assignedByEmployeeId", "supervisor-1");
  form.set("receivedAt", "");
  form.set("sourceNote", "Supervisor message");
  form.set("scheduleNotes", "One known range");
  form.set("overwriteConflicts", overwrite ? "true" : "false");
  buildDateRange(parseDateOnly("2026-08-31"), parseDateOnly("2026-09-08"))
    .forEach((date, index) => {
      const off = index === 1;
      form.append("assignmentDate", date.assignmentDate);
      form.append("dayOfWeek", String(date.dayOfWeek));
      form.append("plannedStatus", off ? "NON_WORKING" : "SCHEDULED");
      form.append("plannedShift", off ? "UNKNOWN" : index === 0 ? "DAY" : "NIGHT");
      form.append("plannedEquipmentId", off ? "" : "equipment-1");
      form.append("actualStatus", off ? "NON_WORKING" : "UNKNOWN");
      form.append("actualShift", "UNKNOWN");
      form.append("actualEquipmentId", "");
      form.append("plannedPrimaryEmployeeId", off ? "" : "employee-1");
      form.append("plannedPartnerEmployeeId", "");
      form.append("actualPrimaryEmployeeId", "");
      form.append("actualPartnerEmployeeId", "");
      form.append("changeReason", "");
      form.append("plannedNotes", "");
      form.append("actualNotes", "");
    });
  return form;
}

function existingAssignment(date: string, plannedStatus = "UNKNOWN") {
  return {
    id: `assignment-${date}`,
    weeklyScheduleId: date < "2026-09-07" ? "week-1" : "week-2",
    assignmentDate: parseDateOnly(date),
    dayOfWeek: parseDateOnly(date).getUTCDay() || 7,
    plannedStatus,
    plannedShift: plannedStatus === "SCHEDULED" ? "DAY" : "UNKNOWN",
    plannedEquipmentId: plannedStatus === "SCHEDULED" ? "equipment-1" : null,
    plannedEquipmentDisplayName: null,
    plannedEquipmentNumber: null,
    plannedEquipmentCategory: null,
    plannedMineName: null,
    plannedCityName: null,
    plannedCityState: null,
    actualStatus: "UNKNOWN",
    actualShift: "UNKNOWN",
    actualEquipmentId: null,
    actualEquipmentDisplayName: null,
    actualEquipmentNumber: null,
    actualEquipmentCategory: null,
    actualMineName: null,
    actualCityName: null,
    actualCityState: null,
    changeReason: null,
    plannedNotes: null,
    actualNotes: null,
    crewMembers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function existingSchedule(id: string, start: string, assignments: ReturnType<typeof existingAssignment>[]) {
  return {
    id,
    weekStartDate: parseDateOnly(start),
    weekEndDate: new Date(parseDateOnly(start).getTime() + 6 * 86_400_000),
    status: "ACTIVE",
    primaryEmployeeId: "employee-1",
    primaryEmployeeDisplayName: "Alex Operator",
    primaryEmployeeKey: "alex operator",
    assignedByEmployeeId: "supervisor-1",
    assignedByDisplayName: "Sam Supervisor",
    receivedAt: null,
    sourceNote: null,
    scheduleNotes: null,
    assignments,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scheduleFindMany.mockResolvedValue([]);
  mocks.employeeFindMany.mockResolvedValue(employees);
  mocks.equipmentFindMany.mockResolvedValue([equipment]);
  mocks.scheduleCreate
    .mockResolvedValueOnce({ id: "week-1" })
    .mockResolvedValueOnce({ id: "week-2" });
  mocks.scheduleUpdate.mockImplementation(({ where }) => Promise.resolve({ id: where.id }));
  mocks.assignmentUpsert.mockResolvedValue({ id: "assignment" });
  mocks.transaction.mockImplementation((callback) => callback({
    weeklySchedule: {
      findMany: mocks.scheduleFindMany,
      create: mocks.scheduleCreate,
      update: mocks.scheduleUpdate,
    },
    dailyAssignment: { upsert: mocks.assignmentUpsert },
    employee: { findMany: mocks.employeeFindMany },
    equipment: { findMany: mocks.equipmentFindMany },
  }));
});

describe("Work Schedule range action", () => {
  it("saves August 31-September 8 into two weekly records in one transaction", async () => {
    await expect(saveScheduleRangeAction(emptyScheduleRangeFormState, rangeForm()))
      .rejects.toThrow(/redirect:\/work-schedule\?saved=range/);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mocks.scheduleCreate).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleCreate.mock.calls.map(([call]) => call.data.weekStartDate)).toEqual([
      parseDateOnly("2026-08-31"),
      parseDateOnly("2026-09-07"),
    ]);
    expect(mocks.assignmentUpsert).toHaveBeenCalledTimes(9);
    const night = mocks.assignmentUpsert.mock.calls.find(([call]) =>
      call.create.assignmentDate.toISOString().startsWith("2026-09-02"),
    )?.[0];
    expect(night.create).toMatchObject({ plannedShift: "NIGHT" });
  });

  it("detects conflicts before writing and requires explicit confirmation", async () => {
    mocks.scheduleFindMany.mockResolvedValue([
      existingSchedule("week-1", "2026-08-31", [existingAssignment("2026-08-31", "SCHEDULED")]),
    ]);

    const result = await saveScheduleRangeAction(emptyScheduleRangeFormState, rangeForm());
    expect(result).toMatchObject({
      status: "conflict",
      conflictDates: ["2026-08-31"],
    });
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
    expect(mocks.scheduleUpdate).not.toHaveBeenCalled();
    expect(mocks.assignmentUpsert).not.toHaveBeenCalled();
  });

  it("updates only submitted dates and leaves September 9-13 untouched", async () => {
    mocks.scheduleFindMany.mockResolvedValue([
      existingSchedule("week-1", "2026-08-31", [existingAssignment("2026-08-31", "SCHEDULED")]),
      existingSchedule("week-2", "2026-09-07", [
        existingAssignment("2026-09-07", "SCHEDULED"),
        existingAssignment("2026-09-09", "SCHEDULED"),
        existingAssignment("2026-09-13", "NON_WORKING"),
      ]),
    ]);

    await expect(saveScheduleRangeAction(emptyScheduleRangeFormState, rangeForm(true)))
      .rejects.toThrow(/redirect:/);
    expect(mocks.scheduleUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.assignmentUpsert).toHaveBeenCalledTimes(9);
    const writtenDates = mocks.assignmentUpsert.mock.calls.map(([call]) =>
      call.create.assignmentDate.toISOString().slice(0, 10),
    );
    expect(writtenDates).not.toContain("2026-09-09");
    expect(writtenDates).not.toContain("2026-09-13");
  });

  it("returns one failure and no success redirect when any weekly write fails", async () => {
    mocks.assignmentUpsert.mockImplementationOnce(() => Promise.resolve({ id: "first" }))
      .mockRejectedValueOnce(new Error("second week failed"));
    const result = await saveScheduleRangeAction(emptyScheduleRangeFormState, rangeForm());

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: "error",
      message: expect.stringContaining("No changes were made"),
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
