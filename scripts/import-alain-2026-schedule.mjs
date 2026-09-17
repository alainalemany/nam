/**
 * ARCHIVED HISTORICAL UTILITY — NOT A SCHEDULING MECHANISM
 *
 * This script was used for the one-time import of Alain Alemany's Work
 * Schedule for 2026-09-23 through 2026-12-31 from:
 *
 *   2026 Wilmer rotation calendar - adopted by Alain
 *
 * It is retained only as a historical and audit record. It must not be used
 * as a normal scheduling mechanism, recurring rule, regeneration process, or
 * source of future schedule truth. All future schedule changes must be made
 * through the normal Work Schedule UI. Manual application edits are
 * authoritative and must never be overwritten or recreated by this script.
 *
 * Execution is explicit and manual. Without --apply the utility is read-only.
 * The completed-import latch permits an exact rerun only as a zero-write no-op
 * and rejects missing, partial, conflicting, or later-edited data.
 *
 * Run inside the deployed application container so it uses the live app's
 * Prisma client and DATABASE_URL:
 *
 *   node /tmp/import-alain-2026-schedule.mjs
 *   node /tmp/import-alain-2026-schedule.mjs --apply
 */

import { createRequire } from "node:module";

const require = createRequire("/app/package.json");
const { Prisma, PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Set to true immediately after the successful 2026-09-17 live import. The
// retained historical script may verify an exact rerun as a no-op, but it must
// never recreate data that a later normal UI edit or deletion changed.
const HISTORICAL_IMPORT_COMPLETED = true;

const IMPORT_START = "2026-09-23";
const IMPORT_END = "2026-12-31";
const PRIMARY_EMPLOYEE_ID = "employee_911601";
const ASSIGNED_BY_EMPLOYEE_ID = "cmsvdac5q0000rw0174yn4va0";
const EQUIPMENT_ID = "cmsapkl95000mpl01fmitk85k";
const SOURCE_NOTE = "2026 Wilmer rotation calendar - adopted by Alain";

const spans = [
  ["NIGHT", "2026-09-23", "2026-09-29"],
  ["OFF", "2026-09-30", "2026-10-02"],
  ["DAY", "2026-10-03", "2026-10-09"],
  ["OFF", "2026-10-10", "2026-10-13"],
  ["NIGHT", "2026-10-14", "2026-10-20"],
  ["OFF", "2026-10-21", "2026-10-23"],
  ["DAY", "2026-10-24", "2026-10-30"],
  ["OFF", "2026-10-31", "2026-11-03"],
  ["NIGHT", "2026-11-04", "2026-11-10"],
  ["OFF", "2026-11-11", "2026-11-13"],
  ["DAY", "2026-11-14", "2026-11-20"],
  ["OFF", "2026-11-21", "2026-11-24"],
  ["NIGHT", "2026-11-25", "2026-12-01"],
  ["OFF", "2026-12-02", "2026-12-05"],
  ["DAY", "2026-12-06", "2026-12-12"],
  ["OFF", "2026-12-13", "2026-12-15"],
  ["NIGHT", "2026-12-16", "2026-12-22"],
  ["OFF", "2026-12-23", "2026-12-26"],
  ["DAY", "2026-12-27", "2026-12-31"],
];

function dateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value) {
  return value.toISOString().slice(0, 10);
}

function addDays(value, days) {
  return new Date(value.getTime() + days * 86_400_000);
}

function mondayFor(value) {
  const day = value.getUTCDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}

function dayOfWeek(value) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

function normalizeEmployeeKey(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildExpectedDates() {
  const result = new Map();
  for (const [kind, start, end] of spans) {
    for (let date = dateOnly(start); date <= dateOnly(end); date = addDays(date, 1)) {
      const key = dateKey(date);
      if (result.has(key)) throw new Error(`Source schedule contains duplicate date ${key}.`);
      result.set(key, kind);
    }
  }
  if (result.size !== 100 || [...result.keys()][0] !== IMPORT_START || [...result.keys()].at(-1) !== IMPORT_END) {
    throw new Error("Source schedule does not cover the required 100-day range exactly.");
  }
  return result;
}

const expectedDates = buildExpectedDates();
const expectedCounts = [...expectedDates.values()].reduce(
  (counts, kind) => ({ ...counts, [kind]: counts[kind] + 1 }),
  { DAY: 0, NIGHT: 0, OFF: 0 },
);
if (expectedCounts.DAY !== 33 || expectedCounts.NIGHT !== 35 || expectedCounts.OFF !== 32) {
  throw new Error(`Source totals are invalid: ${JSON.stringify(expectedCounts)}.`);
}

const weekStartKeys = [...new Set([...expectedDates.keys()].map((key) => dateKey(mondayFor(dateOnly(key)))))];
if (weekStartKeys.length !== 15) throw new Error(`Expected 15 weekly containers, found ${weekStartKeys.length}.`);

function assignmentExpectedData(key, kind, equipment) {
  const off = kind === "OFF";
  return {
    assignmentDate: dateOnly(key),
    dayOfWeek: dayOfWeek(dateOnly(key)),
    plannedStatus: off ? "NON_WORKING" : "SCHEDULED",
    plannedShift: off ? "UNKNOWN" : kind,
    plannedEquipmentId: off ? null : equipment.id,
    plannedEquipmentDisplayName: off ? null : equipment.displayName,
    plannedEquipmentNumber: off ? null : equipment.equipmentNumber,
    plannedEquipmentCategory: off ? null : equipment.category,
    plannedMineName: off ? null : equipment.mine.name,
    plannedCityName: off ? null : equipment.mine.city.name,
    plannedCityState: off ? null : equipment.mine.city.state,
    actualStatus: off ? "NON_WORKING" : "UNKNOWN",
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
  };
}

function equalNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function headerMatches(schedule, employee, assignedBy) {
  return schedule.status === "ACTIVE" &&
    schedule.primaryEmployeeId === employee.id &&
    schedule.primaryEmployeeDisplayName === employee.displayName &&
    schedule.primaryEmployeeKey === normalizeEmployeeKey(employee.displayName) &&
    schedule.assignedByEmployeeId === assignedBy.id &&
    schedule.assignedByDisplayName === assignedBy.displayName &&
    schedule.receivedAt === null &&
    schedule.sourceNote === SOURCE_NOTE &&
    schedule.scheduleNotes === null;
}

const assignmentFields = [
  "dayOfWeek", "plannedStatus", "plannedShift", "plannedEquipmentId",
  "plannedEquipmentDisplayName", "plannedEquipmentNumber", "plannedEquipmentCategory",
  "plannedMineName", "plannedCityName", "plannedCityState", "actualStatus", "actualShift",
  "actualEquipmentId", "actualEquipmentDisplayName", "actualEquipmentNumber",
  "actualEquipmentCategory", "actualMineName", "actualCityName", "actualCityState",
  "changeReason", "plannedNotes", "actualNotes",
];

function assignmentDifferences(existing, expected, employee, kind) {
  const differences = assignmentFields.filter((field) => !equalNullable(existing[field], expected[field]));
  const expectedCrew = kind === "OFF"
    ? []
    : [{ phase: "PLANNED", role: "PRIMARY_EMPLOYEE", employeeId: employee.id, displayName: employee.displayName, isUnknown: false, notes: null }];
  if (existing.crewMembers.length !== expectedCrew.length) {
    differences.push("crewMembers.length");
  } else {
    expectedCrew.forEach((expectedMember, index) => {
      const existingMember = existing.crewMembers[index];
      for (const field of ["phase", "role", "employeeId", "displayName", "isUnknown", "notes"]) {
        if (!equalNullable(existingMember[field], expectedMember[field])) differences.push(`crewMembers.${index}.${field}`);
      }
    });
  }
  return differences;
}

async function inspect(tx) {
  const [employee, assignedBy, equipment, schedules, allAssignmentsInRange] = await Promise.all([
    tx.employee.findUnique({ where: { id: PRIMARY_EMPLOYEE_ID } }),
    tx.employee.findUnique({ where: { id: ASSIGNED_BY_EMPLOYEE_ID } }),
    tx.equipment.findUnique({
      where: { id: EQUIPMENT_ID },
      include: { mine: { include: { city: true } } },
    }),
    tx.weeklySchedule.findMany({
      where: {
        weekStartDate: { in: weekStartKeys.map(dateOnly) },
        primaryEmployeeId: PRIMARY_EMPLOYEE_ID,
      },
      include: {
        assignments: {
          where: { assignmentDate: { gte: dateOnly(IMPORT_START), lte: dateOnly(IMPORT_END) } },
          include: { crewMembers: { orderBy: [{ phase: "asc" }, { role: "asc" }] } },
          orderBy: { assignmentDate: "asc" },
        },
      },
      orderBy: { weekStartDate: "asc" },
    }),
    tx.dailyAssignment.findMany({
      where: { assignmentDate: { gte: dateOnly(IMPORT_START), lte: dateOnly(IMPORT_END) } },
      select: {
        id: true,
        assignmentDate: true,
        weeklySchedule: { select: { primaryEmployeeId: true, primaryEmployeeDisplayName: true } },
      },
      orderBy: { assignmentDate: "asc" },
    }),
  ]);

  if (!employee || employee.id !== PRIMARY_EMPLOYEE_ID || !employee.isActive) {
    throw new Error("The confirmed active Alain Alemany Employee record could not be resolved.");
  }
  if (!assignedBy || !assignedBy.isActive || !assignedBy.isSupervisor) {
    throw new Error("The confirmed active supervisor-eligible Eddy Rey Employee record could not be resolved.");
  }
  if (!equipment || equipment.status !== "ACTIVE" || equipment.displayName !== "MTECK 2100E" || equipment.equipmentNumber !== "101151") {
    throw new Error("The confirmed active MTECK 2100E #101151 Equipment record could not be resolved.");
  }

  const schedulesByWeek = new Map(schedules.map((schedule) => [dateKey(schedule.weekStartDate), schedule]));
  const conflicts = [];
  const identicalDates = [];
  let existingTargetAssignments = 0;

  for (const [key, kind] of expectedDates) {
    const weekKey = dateKey(mondayFor(dateOnly(key)));
    const schedule = schedulesByWeek.get(weekKey);
    if (!schedule) continue;
    if (!headerMatches(schedule, employee, assignedBy)) {
      conflicts.push({ date: key, scope: "WeeklySchedule header", existingScheduleId: schedule.id });
      continue;
    }
    const existing = schedule.assignments.find((assignment) => dateKey(assignment.assignmentDate) === key);
    if (!existing) {
      conflicts.push({ date: key, scope: "missing assignment in an existing imported week" });
      continue;
    }
    existingTargetAssignments += 1;
    const differences = assignmentDifferences(existing, assignmentExpectedData(key, kind, equipment), employee, kind);
    if (differences.length > 0) {
      conflicts.push({ date: key, scope: "DailyAssignment", existingAssignmentId: existing.id, differences });
    } else {
      identicalDates.push(key);
    }
  }

  const targetSchedulesExist = schedules.length > 0;
  const completelyIdentical = schedules.length === 15 && identicalDates.length === 100 && conflicts.length === 0;
  if (targetSchedulesExist && !completelyIdentical && conflicts.length === 0) {
    conflicts.push({ scope: "partial target data exists; refusing to recreate possibly manually removed data" });
  }

  return {
    employee,
    assignedBy,
    equipment,
    schedules,
    allAssignmentsInRange,
    conflicts,
    identicalDates,
    existingTargetAssignments,
    completelyIdentical,
  };
}

function reportFromInspection(inspection, mode) {
  return {
    mode,
    employee: {
      id: inspection.employee.id,
      employeeCode: inspection.employee.employeeCode,
      displayName: inspection.employee.displayName,
    },
    assignedBy: {
      id: inspection.assignedBy.id,
      displayName: inspection.assignedBy.displayName,
    },
    equipment: {
      id: inspection.equipment.id,
      displayName: inspection.equipment.displayName,
      equipmentNumber: inspection.equipment.equipmentNumber,
    },
    dateRange: { start: IMPORT_START, end: IMPORT_END },
    expected: {
      calendarDays: 100,
      workingDays: 68,
      day: expectedCounts.DAY,
      night: expectedCounts.NIGHT,
      off: expectedCounts.OFF,
      weeklySchedules: 15,
      dailyAssignments: 100,
      assignmentCrewMembers: 68,
    },
    existing: {
      targetWeeklySchedules: inspection.schedules.length,
      targetDailyAssignments: inspection.existingTargetAssignments,
      allEmployeeDailyAssignmentsInRange: inspection.allAssignmentsInRange.length,
      identicalDates: inspection.identicalDates.length,
    },
    conflicts: inspection.conflicts,
    wouldOverwrite: false,
  };
}

async function main() {
  if (!apply) {
    const inspection = await prisma.$transaction((tx) => inspect(tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    console.log(JSON.stringify(reportFromInspection(inspection, "dry-run"), null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const inspection = await inspect(tx);
    if (inspection.conflicts.length > 0) {
      throw new Error(`Import conflicts detected; no changes made: ${JSON.stringify(inspection.conflicts)}`);
    }
    if (inspection.completelyIdentical) {
      return { ...reportFromInspection(inspection, "apply"), created: { weeklySchedules: 0, dailyAssignments: 0, assignmentCrewMembers: 0 } };
    }
    if (HISTORICAL_IMPORT_COMPLETED) {
      throw new Error("Historical import is already complete; refusing to recreate or replace later-edited data.");
    }
    if (inspection.schedules.length > 0 || inspection.existingTargetAssignments > 0) {
      throw new Error("Partial target data exists; no changes made.");
    }

    let dailyAssignmentsCreated = 0;
    let crewMembersCreated = 0;
    for (const weekStartKey of weekStartKeys) {
      const weekStartDate = dateOnly(weekStartKey);
      const schedule = await tx.weeklySchedule.create({
        data: {
          weekStartDate,
          weekEndDate: addDays(weekStartDate, 6),
          status: "ACTIVE",
          primaryEmployeeId: inspection.employee.id,
          primaryEmployeeDisplayName: inspection.employee.displayName,
          primaryEmployeeKey: normalizeEmployeeKey(inspection.employee.displayName),
          assignedByEmployeeId: inspection.assignedBy.id,
          assignedByDisplayName: inspection.assignedBy.displayName,
          receivedAt: null,
          sourceNote: SOURCE_NOTE,
          scheduleNotes: null,
        },
      });

      const weekEndDate = addDays(weekStartDate, 6);
      for (const [key, kind] of expectedDates) {
        const assignmentDate = dateOnly(key);
        if (assignmentDate < weekStartDate || assignmentDate > weekEndDate) continue;
        const assignment = await tx.dailyAssignment.create({
          data: {
            ...assignmentExpectedData(key, kind, inspection.equipment),
            weeklyScheduleId: schedule.id,
          },
        });
        dailyAssignmentsCreated += 1;
        if (kind !== "OFF") {
          await tx.assignmentCrewMember.create({
            data: {
              dailyAssignmentId: assignment.id,
              phase: "PLANNED",
              role: "PRIMARY_EMPLOYEE",
              employeeId: inspection.employee.id,
              displayName: inspection.employee.displayName,
              isUnknown: false,
              notes: null,
            },
          });
          crewMembersCreated += 1;
        }
      }
    }

    return {
      ...reportFromInspection(inspection, "apply"),
      created: {
        weeklySchedules: weekStartKeys.length,
        dailyAssignments: dailyAssignmentsCreated,
        assignmentCrewMembers: crewMembersCreated,
      },
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 30_000,
  });

  console.log(JSON.stringify(result, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
