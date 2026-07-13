import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  createWeeklyScheduleAction,
  updateWeeklyScheduleAction,
} from "@/features/work-schedule/actions";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
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
      findMany: mocks.findMany,
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

function appendAssignment(formData: FormData, date: string, dayOfWeek: number) {
  formData.append("assignmentDate", date);
  formData.append("dayOfWeek", String(dayOfWeek));
  formData.append("plannedStatus", dayOfWeek === 1 ? "SCHEDULED" : "UNKNOWN");
  formData.append("plannedShift", dayOfWeek === 1 ? "DAY" : "UNKNOWN");
  formData.append("plannedEquipmentId", dayOfWeek === 1 ? "equipment-1" : "");
  formData.append("actualStatus", "UNKNOWN");
  formData.append("actualShift", "UNKNOWN");
  formData.append("actualEquipmentId", "");
  formData.append("plannedPrimaryDisplayName", "");
  formData.append("plannedPartnerDisplayName", "");
  formData.append("actualPrimaryDisplayName", "");
  formData.append("actualPartnerDisplayName", "");
  formData.append("changeReason", "");
  formData.append("plannedNotes", "");
  formData.append("actualNotes", "");
}

function validFormData() {
  const formData = new FormData();
  formData.set("weekStartDate", "2026-07-13");
  formData.set("status", "ACTIVE");
  formData.set("primaryEmployeeDisplayName", "Alex Operator");
  formData.set("assignedByDisplayName", "Sam Supervisor");
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
    mocks.findMany.mockResolvedValue([equipment]);
    mocks.create.mockResolvedValue({ id: "schedule-1" });
    mocks.findUnique.mockResolvedValue({
      id: "schedule-1",
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
          assignedByDisplayName: "Sam Supervisor",
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

  it("normalizes owner identity before create", async () => {
    const formData = validFormData();
    formData.set("primaryEmployeeDisplayName", "  ALEX   Operator ");

    await expect(
      createWeeklyScheduleAction(
        { status: "idle", message: "", fieldErrors: {}, assignmentErrors: {} },
        formData,
      ),
    ).rejects.toThrow("redirect:/work-schedule/schedule-1");

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          primaryEmployeeDisplayName: "ALEX   Operator",
          primaryEmployeeKey: "alex operator",
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
        data: expect.objectContaining({ primaryEmployeeKey: "alex operator" }),
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
});
