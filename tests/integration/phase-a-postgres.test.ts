import { Prisma, PrismaClient } from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { guardedPhaseADatabaseUrl } from "../helpers/phase-a-postgres-guard";

const injected = vi.hoisted(() => ({ prisma: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: injected.prisma }));

const databaseUrl = guardedPhaseADatabaseUrl();
const describePostgres = databaseUrl ? describe.sequential : describe.skip;

let prisma: PrismaClient;
let saveWeeklyTimesheetAction: typeof import("@/features/timesheets/actions").saveWeeklyTimesheetAction;
let getWorkScheduleAssignmentOptions: typeof import("@/features/timesheets/data").getWorkScheduleAssignmentOptions;
let getPayrollDashboardData: typeof import("@/features/payroll/data").getPayrollDashboardData;

const idleState = { status: "idle" as const, message: "", fieldErrors: {} };

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function clearFixtures() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Paycheck",
      "PayrollPeriod",
      "EmployeePayRate",
      "WorkAllocationSupportPerson",
      "WorkAllocation",
      "DailyTimeEntry",
      "WeeklyTimesheet",
      "AssignmentCrewMember",
      "DailyAssignment",
      "WeeklySchedule",
      "TimesheetWorkCode",
      "TimesheetWorkOrder",
      "TimesheetSupportPerson",
      "Equipment",
      "Mine",
      "City",
      "State",
      "Employee"
    RESTART IDENTITY CASCADE
  `);
}

async function createEmployee(
  id: string,
  displayName = "Alex Operator",
  isActive = true,
) {
  return prisma.employee.create({
    data: { id, employeeCode: `${id}-code`, displayName, isActive },
  });
}

async function createReferences() {
  const city = await prisma.city.create({
    data: { id: "phase-a-city", name: "Synthetic City", state: "WY" },
  });
  const mine = await prisma.mine.create({
    data: { id: "phase-a-mine", cityId: city.id, name: "Synthetic Mine" },
  });
  const equipment = await prisma.equipment.create({
    data: {
      id: "phase-a-equipment",
      mineId: mine.id,
      equipmentNumber: "101151",
      displayName: "MTECK 2100E Dragline",
      category: "DRAGLINE",
    },
  });
  const workCode = await prisma.timesheetWorkCode.create({
    data: {
      id: "phase-a-work-code",
      code: "P-151",
      normalizedCode: "P-151",
      description: "Synthetic production",
    },
  });
  return { equipment, workCode };
}

function timesheetPayload({
  employeeId,
  weekStart = "2026-10-12",
  workDate = "2026-10-14",
  assignmentId = "",
}: {
  employeeId: string;
  weekStart?: string;
  workDate?: string;
  assignmentId?: string;
}) {
  return {
    payrollWeekStartDate: weekStart,
    primaryEmployeeId: employeeId,
    primaryEmployeeDisplayName: "Untrusted client name",
    entries: [{
      workDate,
      clockIn: "17:00",
      clockOut: "05:30",
      unpaidBreakMinutes: 30,
      primaryEquipmentId: "phase-a-equipment",
      workScheduleDailyAssignmentId: assignmentId,
      notes: "Synthetic integration fixture",
      allocations: [{
        sequence: 1,
        workCodeId: "phase-a-work-code",
        workOrderId: "",
        allocatedMinutes: 720,
        supportPersonIds: [],
        notes: "",
      }],
    }],
  };
}

function payloadFormData(payload: ReturnType<typeof timesheetPayload>) {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  return formData;
}

type EntryFixture = {
  id: string;
  workDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  clockIn?: string;
  clockOut?: string;
  unpaidBreakMinutes?: number;
};

async function createTimesheet({
  id,
  employeeId,
  employeeName = "Alex Operator",
  employeeKey = "alex operator",
  weekStart,
  status = "COMPLETED",
  entries,
}: {
  id: string;
  employeeId: string | null;
  employeeName?: string;
  employeeKey?: string;
  weekStart: string;
  status?: "DRAFT" | "COMPLETED";
  entries: EntryFixture[];
}) {
  const start = date(weekStart);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const workedMinutesTotal = entries.reduce(
    (sum, entry) => sum + entry.regularMinutes + entry.overtimeMinutes,
    0,
  );
  return prisma.weeklyTimesheet.create({
    data: {
      id,
      payrollWeekStartDate: start,
      payrollWeekEndDate: end,
      status,
      primaryEmployeeId: employeeId,
      primaryEmployeeDisplayName: employeeName,
      primaryEmployeeKey: employeeKey,
      workedMinutesTotal,
      regularMinutesTotal: entries.reduce((sum, entry) => sum + entry.regularMinutes, 0),
      overtimeMinutesTotal: entries.reduce((sum, entry) => sum + entry.overtimeMinutes, 0),
      entries: {
        create: entries.map((entry) => ({
          id: entry.id,
          workDate: date(entry.workDate),
          clockIn: entry.clockIn ?? "07:00",
          clockOut: entry.clockOut ?? "19:00",
          unpaidBreakMinutes: entry.unpaidBreakMinutes ?? 0,
          workedMinutes: entry.regularMinutes + entry.overtimeMinutes,
          regularMinutes: entry.regularMinutes,
          overtimeMinutes: entry.overtimeMinutes,
          primaryEquipmentDisplayNameSnapshot: "Synthetic Dragline",
          primaryEquipmentNumberSnapshot: "101151",
          primaryEquipmentCategorySnapshot: "DRAGLINE",
          primaryMineNameSnapshot: "Synthetic Mine",
          primaryCityNameSnapshot: "Synthetic City",
          primaryCityStateSnapshot: "WY",
        })),
      },
    },
  });
}

async function createPaycheck({
  id,
  employeeId,
  periodStart,
  periodEnd,
  regularMinutes,
  overtimeMinutes,
  reviewStatus = "CONFIRMED",
}: {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  regularMinutes: number;
  overtimeMinutes: number;
  reviewStatus?: "CONFIRMED" | "NEEDS_REVIEW";
}) {
  const payrollPeriod = await prisma.payrollPeriod.create({
    data: {
      id: `period-${id}`,
      employeeId,
      periodStart: date(periodStart),
      periodEnd: date(periodEnd),
      expectedCheckDate: date("2026-10-21"),
      actualCheckDate: date("2026-10-21"),
    },
  });
  return prisma.paycheck.create({
    data: {
      id,
      employeeId,
      payrollPeriodId: payrollPeriod.id,
      checkDate: date("2026-10-21"),
      regularPaidMinutes: regularMinutes,
      overtimePaidMinutes: overtimeMinutes,
      baseRate: new Prisma.Decimal("33.15"),
      regularEarnings: new Prisma.Decimal("0"),
      overtimeBaseEarnings: new Prisma.Decimal("0"),
      overtimePremiumEarnings: new Prisma.Decimal("0"),
      otherCashEarnings: new Prisma.Decimal("0"),
      grossCashPay: new Prisma.Decimal("0"),
      noncashImputedEarnings: new Prisma.Decimal("0"),
      preTaxDeductions: new Prisma.Decimal("0"),
      employeeTaxes: new Prisma.Decimal("0"),
      postTaxDeductions: new Prisma.Decimal("0"),
      adjustments: new Prisma.Decimal("0"),
      netPay: new Prisma.Decimal("0"),
      sourceFingerprint: `synthetic-${id}`,
      parserVersion: "phase-a-integration-v1",
      reviewStatus,
    },
  });
}

async function createSchedule({
  id,
  employeeId,
  weekStart,
  status = "ACTIVE",
}: {
  id: string;
  employeeId: string;
  weekStart: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
}) {
  const start = date(weekStart);
  return prisma.weeklySchedule.create({
    data: {
      id,
      weekStartDate: start,
      weekEndDate: new Date(start.getTime() + 6 * 86_400_000),
      status,
      primaryEmployeeId: employeeId,
      primaryEmployeeDisplayName: "Alex Operator",
      primaryEmployeeKey: `schedule-${employeeId}`,
      assignedByDisplayName: "Synthetic Scheduler",
      sourceNote: "Synthetic Phase A schedule",
    },
  });
}

function entry(
  id: string,
  workDate: string,
  regularMinutes: number,
  overtimeMinutes = 0,
  overrides: Partial<EntryFixture> = {},
): EntryFixture {
  return { id, workDate, regularMinutes, overtimeMinutes, ...overrides };
}

describePostgres("Phase A PostgreSQL integration", () => {
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    injected.prisma = prisma;
    ({ saveWeeklyTimesheetAction } = await import("@/features/timesheets/actions"));
    ({ getWorkScheduleAssignmentOptions } = await import("@/features/timesheets/data"));
    ({ getPayrollDashboardData } = await import("@/features/payroll/data"));
  });

  beforeEach(async () => {
    await clearFixtures();
  });

  afterAll(async () => {
    if (!prisma) return;
    await clearFixtures();
    await prisma.$disconnect();
  });

  it("persists canonical Employee identity and rejects inactive, invalid, and foreign-key identities", async () => {
    await createReferences();
    await createEmployee("employee-active", "Alex Canonical");
    await createEmployee("employee-inactive", "Inactive Operator", false);

    await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({ employeeId: "employee-active" })),
    );
    const saved = await prisma.weeklyTimesheet.findFirstOrThrow({
      where: { primaryEmployeeId: "employee-active" },
    });
    expect(saved).toMatchObject({
      primaryEmployeeId: "employee-active",
      primaryEmployeeDisplayName: "Alex Canonical",
      primaryEmployeeKey: "alex canonical",
      workedMinutesTotal: 720,
    });

    const inactive = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({
        employeeId: "employee-inactive",
        weekStart: "2026-10-19",
        workDate: "2026-10-21",
      })),
    );
    expect(inactive).toMatchObject({ status: "error", message: expect.stringMatching(/Inactive/) });

    const invalid = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({
        employeeId: "missing-employee",
        weekStart: "2026-10-26",
        workDate: "2026-10-28",
      })),
    );
    expect(invalid).toMatchObject({ status: "error", message: expect.stringMatching(/could not be found/) });

    await expect(prisma.weeklyTimesheet.create({
      data: {
        id: "invalid-foreign-key",
        payrollWeekStartDate: date("2026-11-02"),
        payrollWeekEndDate: date("2026-11-08"),
        primaryEmployeeId: "missing-employee",
        primaryEmployeeDisplayName: "Missing",
        primaryEmployeeKey: "missing",
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });

  it("reports the existing normalized-name uniqueness conflict without reassigning ownership", async () => {
    await createReferences();
    await createEmployee("employee-a", "Alex Operator");
    await createEmployee("employee-b", "  Alex   Operator  ");

    await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({ employeeId: "employee-a" })),
    );
    const conflict = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({ employeeId: "employee-b", workDate: "2026-10-15" })),
    );

    expect(conflict).toMatchObject({
      status: "error",
      message: expect.stringMatching(/already exists/),
    });
    expect(await prisma.weeklyTimesheet.count()).toBe(1);
    expect((await prisma.weeklyTimesheet.findFirstOrThrow()).primaryEmployeeId)
      .toBe("employee-a");
  });

  it("preserves a historical null Employee ID and rolls back a failed constraint transaction", async () => {
    await createReferences();
    await createTimesheet({
      id: "legacy-timesheet",
      employeeId: null,
      employeeName: "Historic Snapshot",
      employeeKey: "historic snapshot",
      weekStart: "2026-10-12",
      status: "DRAFT",
      entries: [entry("legacy-entry", "2026-10-14", 720, 0, {
        clockIn: "17:00",
        clockOut: "05:30",
        unpaidBreakMinutes: 30,
      })],
    });

    await saveWeeklyTimesheetAction(
      "legacy-timesheet",
      idleState,
      payloadFormData(timesheetPayload({ employeeId: "" })),
    );
    const legacy = await prisma.weeklyTimesheet.findUniqueOrThrow({
      where: { id: "legacy-timesheet" },
    });
    expect(legacy).toMatchObject({
      primaryEmployeeId: null,
      primaryEmployeeDisplayName: "Historic Snapshot",
      primaryEmployeeKey: "historic snapshot",
    });

    await expect(prisma.$transaction(async (tx) => {
      await tx.employee.create({
        data: { id: "rollback-employee", displayName: "Rollback Employee" },
      });
      await tx.weeklyTimesheet.create({
        data: {
          id: "rollback-timesheet",
          payrollWeekStartDate: date("2026-10-19"),
          payrollWeekEndDate: date("2026-10-25"),
          primaryEmployeeId: "missing-employee",
          primaryEmployeeDisplayName: "Missing",
          primaryEmployeeKey: "missing",
        },
      });
    })).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.employee.findUnique({ where: { id: "rollback-employee" } }))
      .toBeNull();
  });

  it("discovers only Active/Scheduled choices and exposes the October 14 Night context", async () => {
    await createEmployee("employee-1");
    const schedule = await createSchedule({
      id: "schedule-active",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
    });
    await prisma.dailyAssignment.createMany({
      data: [
        {
          id: "assignment-night",
          weeklyScheduleId: schedule.id,
          assignmentDate: date("2026-10-14"),
          dayOfWeek: 3,
          plannedStatus: "SCHEDULED",
          plannedShift: "NIGHT",
          plannedEquipmentDisplayName: "MTECK 2100E Dragline",
          plannedEquipmentNumber: "101151",
        },
        {
          id: "assignment-off",
          weeklyScheduleId: schedule.id,
          assignmentDate: date("2026-10-15"),
          dayOfWeek: 4,
          plannedStatus: "NON_WORKING",
        },
        {
          id: "assignment-cancelled",
          weeklyScheduleId: schedule.id,
          assignmentDate: date("2026-10-16"),
          dayOfWeek: 5,
          plannedStatus: "SCHEDULED",
          actualStatus: "CANCELLED",
        },
        {
          id: "assignment-unknown",
          weeklyScheduleId: schedule.id,
          assignmentDate: date("2026-10-17"),
          dayOfWeek: 6,
          plannedStatus: "UNKNOWN",
        },
      ],
    });

    const options = await getWorkScheduleAssignmentOptions("employee-1", "2026-10-12");
    expect(options).toHaveLength(4);
    expect(options.find((item) => item.id === "assignment-night")).toMatchObject({
      workDate: "2026-10-14",
      selectable: true,
      label: expect.stringMatching(/Night.*MTECK 2100E Dragline #101151/),
    });
    for (const id of ["assignment-off", "assignment-cancelled", "assignment-unknown"]) {
      expect(options.find((item) => item.id === id)?.selectable).toBe(false);
    }

    const draft = await createSchedule({
      id: "schedule-draft",
      employeeId: "employee-1",
      weekStart: "2026-10-19",
      status: "DRAFT",
    });
    await prisma.dailyAssignment.create({
      data: {
        id: "assignment-draft",
        weeklyScheduleId: draft.id,
        assignmentDate: date("2026-10-21"),
        dayOfWeek: 3,
        plannedStatus: "SCHEDULED",
      },
    });
    expect((await getWorkScheduleAssignmentOptions("employee-1", "2026-10-19"))[0])
      .toMatchObject({ selectable: false, warning: expect.stringMatching(/draft/) });
  });

  it("rejects wrong-owner, wrong-date, and ineligible new assignment links", async () => {
    await createReferences();
    await createEmployee("employee-1");
    await createEmployee("employee-2", "Other Operator");

    const other = await createSchedule({
      id: "schedule-other",
      employeeId: "employee-2",
      weekStart: "2026-10-12",
    });
    const dateMismatch = await createSchedule({
      id: "schedule-date",
      employeeId: "employee-1",
      weekStart: "2026-10-19",
    });
    const ineligible = await createSchedule({
      id: "schedule-ineligible",
      employeeId: "employee-1",
      weekStart: "2026-10-26",
      status: "ARCHIVED",
    });
    await prisma.dailyAssignment.createMany({
      data: [
        { id: "other-assignment", weeklyScheduleId: other.id, assignmentDate: date("2026-10-14"), dayOfWeek: 3, plannedStatus: "SCHEDULED" },
        { id: "wrong-date-assignment", weeklyScheduleId: dateMismatch.id, assignmentDate: date("2026-10-20"), dayOfWeek: 2, plannedStatus: "SCHEDULED" },
        { id: "ineligible-assignment", weeklyScheduleId: ineligible.id, assignmentDate: date("2026-10-28"), dayOfWeek: 3, plannedStatus: "SCHEDULED" },
      ],
    });

    const otherResult = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({ employeeId: "employee-1", assignmentId: "other-assignment" })),
    );
    expect(otherResult).toMatchObject({ status: "error", message: expect.stringMatching(/same Timesheet employee/) });

    const wrongDateResult = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({
        employeeId: "employee-1",
        weekStart: "2026-10-19",
        workDate: "2026-10-21",
        assignmentId: "wrong-date-assignment",
      })),
    );
    expect(wrongDateResult).toMatchObject({ status: "error", message: expect.stringMatching(/work date/) });

    const ineligibleResult = await saveWeeklyTimesheetAction(
      null,
      idleState,
      payloadFormData(timesheetPayload({
        employeeId: "employee-1",
        weekStart: "2026-10-26",
        workDate: "2026-10-28",
        assignmentId: "ineligible-assignment",
      })),
    );
    expect(ineligibleResult).toMatchObject({ status: "error", message: expect.stringMatching(/Active scheduled/) });
    expect(await prisma.weeklyTimesheet.count()).toBe(0);
  });

  it("preserves an unchanged historical assignment after its schedule becomes ineligible", async () => {
    await createReferences();
    await createEmployee("employee-1");
    const schedule = await createSchedule({
      id: "historical-schedule",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
    });
    await prisma.dailyAssignment.create({
      data: {
        id: "historical-assignment",
        weeklyScheduleId: schedule.id,
        assignmentDate: date("2026-10-14"),
        dayOfWeek: 3,
        plannedStatus: "SCHEDULED",
      },
    });
    const payload = timesheetPayload({
      employeeId: "employee-1",
      assignmentId: "historical-assignment",
    });
    await saveWeeklyTimesheetAction(null, idleState, payloadFormData(payload));
    const timesheet = await prisma.weeklyTimesheet.findFirstOrThrow();
    await prisma.weeklySchedule.update({
      where: { id: schedule.id },
      data: { status: "ARCHIVED" },
    });

    await saveWeeklyTimesheetAction(timesheet.id, idleState, payloadFormData(payload));
    const savedEntry = await prisma.dailyTimeEntry.findFirstOrThrow();
    expect(savedEntry.workScheduleDailyAssignmentId).toBe("historical-assignment");
  });

  it("uses inclusive midweek boundaries across two NAM weeks without double counting", async () => {
    await createEmployee("employee-1");
    await createTimesheet({
      id: "week-one",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
      entries: [
        entry("outside-before", "2026-10-13", 100),
        entry("inclusive-start", "2026-10-14", 600),
      ],
    });
    await createTimesheet({
      id: "week-two",
      employeeId: "employee-1",
      weekStart: "2026-10-19",
      entries: [
        entry("inclusive-end", "2026-10-20", 600),
        entry("outside-after", "2026-10-21", 100),
      ],
    });
    await createPaycheck({
      id: "paycheck-midweek",
      employeeId: "employee-1",
      periodStart: "2026-10-14",
      periodEnd: "2026-10-20",
      regularMinutes: 1200,
      overtimeMinutes: 0,
    });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "RECONCILED",
      reason: "FULL_AGGREGATE_MATCH",
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    });
    expect(dashboard.summary.reconciledMinutes).toBe(1200);
  });

  it("reconciles a Workday period spanning three NAM weeks", async () => {
    await createEmployee("employee-1");
    await createTimesheet({ id: "week-one", employeeId: "employee-1", weekStart: "2026-09-28", entries: [entry("entry-one", "2026-10-02", 600)] });
    await createTimesheet({ id: "week-two", employeeId: "employee-1", weekStart: "2026-10-05", entries: [entry("entry-two", "2026-10-08", 600, 300)] });
    await createTimesheet({ id: "week-three", employeeId: "employee-1", weekStart: "2026-10-12", entries: [entry("entry-three", "2026-10-12", 600, 300)] });
    await createPaycheck({
      id: "paycheck-three-weeks",
      employeeId: "employee-1",
      periodStart: "2026-10-02",
      periodEnd: "2026-10-12",
      regularMinutes: 1800,
      overtimeMinutes: 600,
    });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "RECONCILED",
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    });
  });

  it("attributes an overnight 720-minute shift entirely to its start date", async () => {
    await createEmployee("employee-1");
    await createTimesheet({
      id: "overnight-week",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
      entries: [entry("overnight-entry", "2026-10-14", 720, 0, {
        clockIn: "17:00",
        clockOut: "05:30",
        unpaidBreakMinutes: 30,
      })],
    });
    await createPaycheck({
      id: "overnight-paycheck",
      employeeId: "employee-1",
      periodStart: "2026-10-14",
      periodEnd: "2026-10-14",
      regularMinutes: 720,
      overtimeMinutes: 0,
    });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0].status).toBe("RECONCILED");
    expect(dashboard.paychecks[0].boundaryExplanation).toMatch(/start-date workDate/);
    expect(dashboard.days.find((item) => item.date === "2026-10-14")?.timesheetMinutes)
      .toBe(720);
    expect(dashboard.days.find((item) => item.date === "2026-10-15")?.timesheetMinutes)
      .toBeUndefined();
  });

  it("keeps Draft and missing weekly coverage out of reconciled evidence", async () => {
    await createEmployee("employee-1");
    await createTimesheet({
      id: "draft-week",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
      status: "DRAFT",
      entries: [entry("draft-entry", "2026-10-14", 600)],
    });
    await createPaycheck({
      id: "draft-paycheck",
      employeeId: "employee-1",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-18",
      regularMinutes: 600,
      overtimeMinutes: 0,
    });
    await createPaycheck({
      id: "missing-week-paycheck",
      employeeId: "employee-1",
      periodStart: "2026-10-19",
      periodEnd: "2026-10-25",
      regularMinutes: 0,
      overtimeMinutes: 0,
    });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    const draft = dashboard.paychecks.find((item) => item.id === "draft-paycheck")!;
    const missing = dashboard.paychecks.find((item) => item.id === "missing-week-paycheck")!;
    expect(draft).toMatchObject({ status: "NEEDS_REVIEW", reasons: expect.arrayContaining(["DRAFT_TIMESHEET_EVIDENCE"]) });
    expect(missing).toMatchObject({ status: "NEEDS_REVIEW", reasons: expect.arrayContaining(["MISSING_TIMESHEET_EVIDENCE"]) });
  });

  it("excludes legacy null-ID evidence and flags duplicate canonical work dates", async () => {
    await createEmployee("employee-1");
    await createTimesheet({ id: "canonical-a", employeeId: "employee-1", weekStart: "2026-10-12", entries: [entry("canonical-entry-a", "2026-10-14", 600)] });
    await createTimesheet({ id: "canonical-b", employeeId: "employee-1", employeeKey: "employee-1-alias", weekStart: "2026-10-12", entries: [entry("canonical-entry-b", "2026-10-14", 600)] });
    await createTimesheet({ id: "legacy", employeeId: null, weekStart: "2026-10-05", entries: [entry("legacy-entry", "2026-10-15", 900)] });
    await createPaycheck({
      id: "ambiguous-paycheck",
      employeeId: "employee-1",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-18",
      regularMinutes: 1200,
      overtimeMinutes: 0,
    });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "NEEDS_REVIEW",
      reasons: expect.arrayContaining([
        "AMBIGUOUS_TIMESHEET_EVIDENCE",
        "UNRESOLVED_EMPLOYEE_IDENTITY",
      ]),
      differences: { totalMinutes: 0 },
    });
  });

  it("marks both overlapping payroll periods as ambiguous evidence", async () => {
    await createEmployee("employee-1");
    await createTimesheet({ id: "week-one", employeeId: "employee-1", weekStart: "2026-10-12", entries: [entry("entry-one", "2026-10-14", 600)] });
    await createTimesheet({ id: "week-two", employeeId: "employee-1", weekStart: "2026-10-19", entries: [entry("entry-two", "2026-10-19", 600)] });
    await createPaycheck({ id: "paycheck-a", employeeId: "employee-1", periodStart: "2026-10-12", periodEnd: "2026-10-18", regularMinutes: 600, overtimeMinutes: 0 });
    await createPaycheck({ id: "paycheck-b", employeeId: "employee-1", periodStart: "2026-10-14", periodEnd: "2026-10-20", regularMinutes: 1200, overtimeMinutes: 0 });

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    for (const paycheck of dashboard.paychecks) {
      expect(paycheck).toMatchObject({
        status: "NEEDS_REVIEW",
        reasons: expect.arrayContaining(["OVERLAPPING_PAYROLL_EVIDENCE"]),
      });
    }
    expect(dashboard.summary.reconciledMinutes).toBe(0);
  });

  it("requires confirmed evidence and independently compares regular and overtime minutes", async () => {
    await createEmployee("employee-1");
    await createTimesheet({
      id: "classification-week",
      employeeId: "employee-1",
      weekStart: "2026-10-12",
      entries: [entry("classification-entry", "2026-10-14", 2400, 1200)],
    });
    await createPaycheck({
      id: "unconfirmed-paycheck",
      employeeId: "employee-1",
      periodStart: "2026-10-12",
      periodEnd: "2026-10-18",
      regularMinutes: 2400,
      overtimeMinutes: 1200,
      reviewStatus: "NEEDS_REVIEW",
    });

    let dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "NEEDS_REVIEW",
      reason: "UNCONFIRMED_PAYCHECK_EVIDENCE",
    });
    expect(dashboard.summary.reconciledMinutes).toBe(0);

    await prisma.paycheck.update({
      where: { id: "unconfirmed-paycheck" },
      data: { reviewStatus: "CONFIRMED", regularPaidMinutes: 2160, overtimePaidMinutes: 1440 },
    });
    dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "DISCREPANCY",
      reason: "REGULAR_OVERTIME_CLASSIFICATION_MISMATCH",
      differences: { totalMinutes: 0, regularMinutes: 240, overtimeMinutes: -240 },
    });

    await prisma.paycheck.update({
      where: { id: "unconfirmed-paycheck" },
      data: { regularPaidMinutes: 2400, overtimePaidMinutes: 1200 },
    });
    dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0]).toMatchObject({
      status: "RECONCILED",
      reason: "FULL_AGGREGATE_MATCH",
      differences: { totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0 },
    });
  });

  it("performs reconciliation reads without changing source records", async () => {
    await createEmployee("employee-1");
    await createTimesheet({ id: "read-only-week", employeeId: "employee-1", weekStart: "2026-10-12", entries: [entry("read-only-entry", "2026-10-14", 600)] });
    await createPaycheck({ id: "read-only-paycheck", employeeId: "employee-1", periodStart: "2026-10-12", periodEnd: "2026-10-18", regularMinutes: 600, overtimeMinutes: 0 });

    const before = {
      employees: await prisma.employee.count(),
      timesheets: await prisma.weeklyTimesheet.count(),
      entries: await prisma.dailyTimeEntry.count(),
      periods: await prisma.payrollPeriod.count(),
      paychecks: await prisma.paycheck.count(),
      timesheet: await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: "read-only-week" } }),
      paycheck: await prisma.paycheck.findUniqueOrThrow({ where: { id: "read-only-paycheck" } }),
    };

    const dashboard = await getPayrollDashboardData("employee-1", "2026-10");
    expect(dashboard.paychecks[0].status).toBe("RECONCILED");

    const after = {
      employees: await prisma.employee.count(),
      timesheets: await prisma.weeklyTimesheet.count(),
      entries: await prisma.dailyTimeEntry.count(),
      periods: await prisma.payrollPeriod.count(),
      paychecks: await prisma.paycheck.count(),
      timesheet: await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: "read-only-week" } }),
      paycheck: await prisma.paycheck.findUniqueOrThrow({ where: { id: "read-only-paycheck" } }),
    };
    expect(after).toEqual(before);
  });
});
