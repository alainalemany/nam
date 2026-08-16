import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  createWeeklyScheduleAction,
  updateWeeklyScheduleAction,
} from "@/features/work-schedule/actions";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  equipmentFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    equipment: {
      findMany: mocks.equipmentFindMany,
    },
    employee: {
      findMany: mocks.employeeFindMany,
    },
    weeklySchedule: {
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

const equipment = {
  id: "equipment-1",
  displayName: "Dragline 7",
  equipmentNumber: "DL-7",
  category: "DRAGLINE",
  mine: {
    name: "North Mine",
    city: {
      name: "Gillette",
      state: "WY",
    },
  },
};

const employees = [
  { id: "employee-1", employeeCode: "100", displayName: "Alex Operator", isActive: true, isSupervisor: false },
  { id: "supervisor-1", employeeCode: "200", displayName: "Sam Supervisor", isActive: true, isSupervisor: true },
];

function appendAssignment(formData: FormData, date: string, dayOfWeek: number) {
  formData.append("assignmentDate", date);
  formData.append("dayOfWeek", String(dayOfWeek));
  formData.append("plannedStatus", dayOfWeek === 1 ? "SCHEDULED" : "UNKNOWN");
  formData.append("plannedShift", dayOfWeek === 1 ? "DAY" : "UNKNOWN");
  formData.append("plannedEquipmentId", dayOfWeek === 1 ? "equipment-1" : "");
  formData.append("actualStatus", "UNKNOWN");
  formData.append("actualShift", "UNKNOWN");
  formData.append("actualEquipmentId", "");
  formData.append("plannedPrimaryEmployeeId", "employee-1");
  formData.append("plannedPartnerEmployeeId", "");
  formData.append("actualPrimaryEmployeeId", "employee-1");
  formData.append("actualPartnerEmployeeId", "");
  formData.append("changeReason", "");
  formData.append("plannedNotes", "");
  formData.append("actualNotes", "");
}

function validFormData() {
  const formData = new FormData();
  formData.set("weekStartDate", "2026-07-13");
  formData.set("status", "ACTIVE");
  formData.set("primaryEmployeeId", "employee-1");
  formData.set("assignedByEmployeeId", "supervisor-1");
  formData.set("receivedAt", "");
  formData.set("sourceNote", "");
  formData.set("scheduleNotes", "");

  [
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ].forEach((date, index) => appendAssignment(formData, date, index + 1));

  return formData;
}

describe("Work Schedule Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.equipmentFindMany.mockResolvedValue([equipment]);
    mocks.employeeFindMany.mockResolvedValue(employees);
    mocks.create.mockResolvedValue({ id: "schedule-1" });
    mocks.findUnique.mockResolvedValue({
      id: "schedule-1",
      primaryEmployeeId: "employee-1",
      primaryEmployeeDisplayName: "Historic Alex Operator",
      primaryEmployeeKey: "alex operator",
      assignedByEmployeeId: "supervisor-1",
      assignedByDisplayName: "Historic Sam Supervisor",
      assignments: [
        {
          assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
          plannedEquipmentId: "equipment-1",
          plannedEquipmentDisplayName: "Historic Planned Dragline",
          plannedEquipmentNumber: "HP-1",
          plannedEquipmentCategory: "DRAGLINE",
          plannedMineName: "Historic Planned Mine",
          plannedCityName: "Historic Planned City",
          plannedCityState: "WY",
          actualEquipmentId: null,
          actualEquipmentDisplayName: "Historic Actual Dragline",
          actualEquipmentNumber: "HA-1",
          actualEquipmentCategory: "DRAGLINE",
          actualMineName: "Historic Actual Mine",
          actualCityName: "Historic Actual City",
          actualCityState: "WY",
          crewMembers: [
            { phase: "PLANNED", role: "PRIMARY_EMPLOYEE", employeeId: "employee-1", displayName: "Historic Alex Operator", isUnknown: false },
            { phase: "ACTUAL", role: "PRIMARY_EMPLOYEE", employeeId: "employee-1", displayName: "Historic Alex Operator", isUnknown: false },
          ],
        },
      ],
    });
    mocks.update.mockResolvedValue({ id: "schedule-1" });
    mocks.upsert.mockResolvedValue({ id: "assignment-1" });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.transaction.mockImplementation((callback) =>
      callback({
        dailyAssignment: {
          deleteMany: mocks.deleteMany,
          upsert: mocks.upsert,
        },
        weeklySchedule: {
          create: mocks.create,
          findUnique: mocks.findUnique,
          update: mocks.update,
        },
      }),
    );
  });

  it("saves a weekly grid through a single Prisma transaction", async () => {
    await expect(
      createWeeklyScheduleAction(
        { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
        validFormData(),
      ),
    ).rejects.toThrow("redirect:/work-schedule/schedule-1");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryEmployeeDisplayName: "Alex Operator",
          primaryEmployeeKey: "alex operator",
          primaryEmployeeId: "employee-1",
          assignedByDisplayName: "Sam Supervisor",
          assignedByEmployeeId: "supervisor-1",
          assignments: {
            create: expect.arrayContaining([
              expect.objectContaining({
                assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
                plannedEquipmentId: "equipment-1",
                plannedEquipmentDisplayName: "Dragline 7",
                plannedMineName: "North Mine",
              }),
            ]),
          },
        }),
      }),
    );
  });

  it("snapshots canonical employee identity before create", async () => {
    await expect(
      createWeeklyScheduleAction(
        { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
        validFormData(),
      ),
    ).rejects.toThrow("redirect:/work-schedule/schedule-1");

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryEmployeeId: "employee-1",
          primaryEmployeeDisplayName: "Alex Operator",
          primaryEmployeeKey: "alex operator",
          assignedByEmployeeId: "supervisor-1",
          assignedByDisplayName: "Sam Supervisor",
        }),
      }),
    );
  });

  it("returns a safe message for duplicate normalized owner/week combinations", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await createWeeklyScheduleAction(
      { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
      validFormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "A Work Schedule already exists for this employee and week.",
    });
  });

  it("returns every submitted weekly and daily value with field-specific validation errors", async () => {
    const formData = validFormData();
    const replaceFirst = (field: string, value: string) => {
      const values = formData.getAll(field).map(String);
      values[0] = value;
      formData.delete(field);
      values.forEach((item) => formData.append(field, item));
    };
    formData.set("weekStartDate", "2026-07-14");
    formData.set("status", "DRAFT");
    formData.set("primaryEmployeeId", "employee-1");
    formData.set("assignedByEmployeeId", "supervisor-1");
    formData.set("receivedAt", "2026-07-12T16:45");
    formData.set("sourceNote", "Original SMS");
    formData.set("scheduleNotes", "Keep this weekly note");
    replaceFirst("plannedStatus", "SCHEDULED");
    replaceFirst("plannedShift", "DAY");
    replaceFirst("plannedEquipmentId", "equipment-1");
    replaceFirst("actualStatus", "SCHEDULED");
    replaceFirst("actualShift", "UNKNOWN");
    replaceFirst("actualEquipmentId", "equipment-1");
    replaceFirst("plannedPrimaryEmployeeId", "employee-1");
    replaceFirst("plannedPartnerEmployeeId", "");
    formData.set("plannedPartnerUnknown-0", "on");
    replaceFirst("actualPrimaryEmployeeId", "employee-1");
    replaceFirst("actualPartnerEmployeeId", "");
    formData.set("actualPartnerUnknown-0", "on");
    replaceFirst("changeReason", "Submitted reason");
    replaceFirst("plannedNotes", "Submitted plan");
    replaceFirst("actualNotes", "Submitted actual");

    const result = await createWeeklyScheduleAction(
      { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
      formData,
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { weekStartDate: ["Week must start on Monday."] },
      assignmentErrors: { 0: { actualShift: ["Assignment 1 needs an actual shift."] } },
      submittedValues: expect.objectContaining({
        weekStartDate: "2026-07-14",
        status: "DRAFT",
        primaryEmployeeId: "employee-1",
        assignedByEmployeeId: "supervisor-1",
        receivedAt: "2026-07-12T16:45",
        sourceNote: "Original SMS",
        scheduleNotes: "Keep this weekly note",
      }),
    });
    expect(result.submittedValues?.assignments).toHaveLength(7);
    expect(result.submittedValues?.assignments[0]).toMatchObject({
      plannedStatus: "SCHEDULED",
      plannedShift: "DAY",
      plannedEquipmentId: "equipment-1",
      actualStatus: "SCHEDULED",
      actualShift: "UNKNOWN",
      actualEquipmentId: "equipment-1",
      plannedPrimaryEmployeeId: "employee-1",
      plannedPartnerUnknown: true,
      actualPrimaryEmployeeId: "employee-1",
      actualPartnerUnknown: true,
      changeReason: "Submitted reason",
      plannedNotes: "Submitted plan",
      actualNotes: "Submitted actual",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-supervisor Assigned By selection", async () => {
    const formData = validFormData();
    formData.set("assignedByEmployeeId", "employee-1");

    const result = await createWeeklyScheduleAction(
      { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
      formData,
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Assigned By must be an eligible supervisor.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates daily assignments in place and preserves unchanged snapshots", async () => {
    await expect(
      updateWeeklyScheduleAction(
        "schedule-1",
        { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
        validFormData(),
      ),
    ).rejects.toThrow("redirect:/work-schedule/schedule-1");

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "schedule-1" },
        data: expect.objectContaining({
          primaryEmployeeId: "employee-1",
          primaryEmployeeDisplayName: "Historic Alex Operator",
          primaryEmployeeKey: "alex operator",
        }),
      }),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          weeklyScheduleId_assignmentDate: {
            weeklyScheduleId: "schedule-1",
            assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
          },
        },
        update: expect.objectContaining({
          plannedEquipmentDisplayName: "Historic Planned Dragline",
          actualEquipmentDisplayName: "Historic Actual Dragline",
          crewMembers: expect.objectContaining({
            deleteMany: {},
            create: expect.any(Array),
          }),
        }),
      }),
    );
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: {
        weeklyScheduleId: "schedule-1",
        assignmentDate: {
          notIn: expect.arrayContaining([new Date("2026-07-13T00:00:00.000Z")]),
        },
      },
    });
  });

  it("preserves legacy free-text identities when an old schedule remains unlinked", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "schedule-legacy",
      primaryEmployeeId: null,
      primaryEmployeeDisplayName: "Legacy Operator",
      primaryEmployeeKey: "legacy operator",
      assignedByEmployeeId: null,
      assignedByDisplayName: "Legacy Supervisor",
      assignments: [
        {
          assignmentDate: new Date("2026-07-13T00:00:00.000Z"),
          plannedEquipmentId: "equipment-1",
          plannedEquipmentDisplayName: "Historic Planned Dragline",
          plannedEquipmentNumber: "HP-1",
          plannedEquipmentCategory: "DRAGLINE",
          plannedMineName: "Historic Planned Mine",
          plannedCityName: "Historic Planned City",
          plannedCityState: "WY",
          actualEquipmentId: null,
          actualEquipmentDisplayName: null,
          actualEquipmentNumber: null,
          actualEquipmentCategory: null,
          actualMineName: null,
          actualCityName: null,
          actualCityState: null,
          crewMembers: [
            { phase: "PLANNED", role: "PRIMARY_EMPLOYEE", employeeId: null, displayName: "Legacy Operator", isUnknown: false },
            { phase: "PLANNED", role: "PARTNER", employeeId: null, displayName: "Legacy Partner", isUnknown: false },
          ],
        },
      ],
    });
    mocks.employeeFindMany.mockResolvedValue([]);
    const formData = validFormData();
    formData.set("primaryEmployeeId", "");
    formData.set("assignedByEmployeeId", "");
    formData.set("plannedPrimaryEmployeeId", "");
    formData.set("actualPrimaryEmployeeId", "");

    await expect(
      updateWeeklyScheduleAction(
        "schedule-legacy",
        { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
        formData,
      ),
    ).rejects.toThrow("redirect:/work-schedule/schedule-legacy");

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryEmployeeId: null,
          primaryEmployeeDisplayName: "Legacy Operator",
          primaryEmployeeKey: "legacy operator",
          assignedByEmployeeId: null,
          assignedByDisplayName: "Legacy Supervisor",
        }),
      }),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          crewMembers: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ employeeId: null, displayName: "Legacy Operator" }),
              expect.objectContaining({ employeeId: null, displayName: "Legacy Partner" }),
            ]),
          }),
        }),
      }),
    );
  });
});
