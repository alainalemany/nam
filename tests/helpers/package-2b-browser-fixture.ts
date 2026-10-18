import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import { PACKAGE_2B_BROWSER_FIXTURE_MARKER } from "./package-2b-browser-guard";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const fingerprint = (value: string) => createHash("sha256").update(`${PACKAGE_2B_BROWSER_FIXTURE_MARKER}:${value}`).digest("hex");

type FixtureOptions = { includeVerifiedRate?: boolean };

async function createPaycheck(
  prisma: PrismaClient,
  input: { id: string; periodStart: string; periodEnd: string; checkDate: string; baseRate: string },
) {
  const periodId = `${input.id}-period`;
  await prisma.payrollPeriod.create({
    data: {
      id: periodId,
      employeeId: "browser-owner",
      periodStart: date(input.periodStart),
      periodEnd: date(input.periodEnd),
      expectedCheckDate: date(input.checkDate),
      actualCheckDate: date(input.checkDate),
    },
  });
  return prisma.paycheck.create({
    data: {
      id: input.id,
      employeeId: "browser-owner",
      payrollPeriodId: periodId,
      checkDate: date(input.checkDate),
      regularPaidMinutes: 2_400,
      overtimePaidMinutes: 0,
      baseRate: new Prisma.Decimal(input.baseRate),
      regularEarnings: new Prisma.Decimal(input.baseRate).mul(40),
      grossCashPay: new Prisma.Decimal(input.baseRate).mul(40),
      netPay: new Prisma.Decimal(input.baseRate).mul(30),
      sourceFingerprint: fingerprint(input.id),
      parserVersion: PACKAGE_2B_BROWSER_FIXTURE_MARKER,
      evidenceRevision: 1,
      reviewStatus: "CONFIRMED",
      notes: "Synthetic Package 2B browser fixture; never production evidence.",
    },
  });
}

async function createObservation(
  prisma: PrismaClient,
  input: {
    id: string;
    paycheckId: string;
    row: number;
    rate: string;
    periodStart: string;
    periodEnd: string;
    classifications: Array<
      "FIRST_RATE_CANDIDATE" |
      "REPEATED_SUPPORTING_OBSERVATION" |
      "CANDIDATE_INCREASE" |
      "CANDIDATE_DECREASE" |
      "SAME_DATE_CONFLICT" |
      "UNCERTAIN_EFFECTIVE_DATE_CHANGE"
    >;
  },
) {
  const observation = await prisma.payRateObservation.create({
    data: {
      id: input.id,
      employeeId: "browser-owner",
      sourcePaycheckId: input.paycheckId,
      sourcePaycheckEvidenceRevision: 1,
      sourceRowSequence: input.row,
      observedHourlyRate: new Prisma.Decimal(input.rate),
      regularMinutes: 2_400,
      regularEarnings: new Prisma.Decimal(input.rate).mul(40),
      observedDateStart: date(input.periodStart),
      observedDateEnd: date(input.periodEnd),
      payPeriodStart: date(input.periodStart),
      payPeriodEnd: date(input.periodEnd),
      extractionBasis: "WORKDAY_REGULAR_ROW",
      dateConfidence: "EXPLICIT_ROW_RANGE",
      observationState: "SUPPORTED",
      parserVersion: PACKAGE_2B_BROWSER_FIXTURE_MARKER,
      observationDigest: fingerprint(input.id),
    },
  });
  await prisma.payRateObservationClassification.createMany({
    data: input.classifications.map((kind, index) => ({
      id: `${input.id}-classification-${index + 1}`,
      observationId: observation.id,
      kind,
    })),
  });
  return observation;
}

async function createCandidate(
  prisma: PrismaClient,
  input: { id: string; rate: string; start: string; end: string; observationIds: string[] },
) {
  await prisma.payRateBoundaryCandidate.create({
    data: {
      id: input.id,
      employeeId: "browser-owner",
      observedHourlyRate: new Prisma.Decimal(input.rate),
      earliestEffectiveDate: date(input.start),
      latestEffectiveDate: date(input.end),
      observations: {
        create: input.observationIds.map((observationId, index) => ({
          id: `${input.id}-observation-${index + 1}`,
          observationId,
        })),
      },
    },
  });
}

async function createAffectedWorkDates(prisma: PrismaClient) {
  for (const [index, workDate] of ["2026-08-05", "2026-09-08"].entries()) {
    const weekStart = index === 0 ? "2026-08-03" : "2026-09-07";
    const timesheetId = `browser-rate-history-timesheet-${index + 1}`;
    await prisma.weeklyTimesheet.create({
      data: {
        id: timesheetId,
        payrollWeekStartDate: date(weekStart),
        payrollWeekEndDate: new Date(date(weekStart).getTime() + 6 * 86_400_000),
        status: "COMPLETED",
        primaryEmployeeDisplayName: "Browser Payroll Owner With An Intentionally Long Synthetic Identifier",
        primaryEmployeeKey: `browser-payroll-owner-${index + 1}`,
        primaryEmployeeId: "browser-owner",
        primaryEmployeeIdentityStatus: "OWNER_VERIFIED",
        workedMinutesTotal: 480,
        regularMinutesTotal: 480,
      },
    });
    await prisma.dailyTimeEntry.create({
      data: {
        id: `browser-rate-history-entry-${index + 1}`,
        weeklyTimesheetId: timesheetId,
        workDate: date(workDate),
        clockIn: "08:00",
        clockOut: "16:00",
        workedMinutes: 480,
        regularMinutes: 480,
        overtimeMinutes: 0,
        primaryEquipmentDisplayNameSnapshot: "Synthetic browser fixture equipment",
        primaryEquipmentCategorySnapshot: "OTHER",
        primaryMineNameSnapshot: "Synthetic browser fixture mine",
        primaryCityNameSnapshot: "Synthetic browser fixture city",
        notes: "Synthetic Package 2B browser fixture; never production work evidence.",
      },
    });
  }
}

export async function resetPackage2BBrowserRateHistoryFixture(
  prisma: PrismaClient,
  options: FixtureOptions = {},
) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Employee" RESTART IDENTITY CASCADE');
  await prisma.employee.createMany({
    data: [
      {
        id: "browser-owner",
        employeeCode: "BROWSER-OWNER-LONG-SYNTHETIC-CODE-0001",
        displayName: "Browser Payroll Owner With An Intentionally Long Synthetic Identifier",
      },
      {
        id: "browser-not-reviewer",
        employeeCode: "BROWSER-NON-REVIEWER",
        displayName: "Browser Non-reviewer",
      },
    ],
  });

  const paychecks = [
    { id: "browser-rate-paycheck-base-1", periodStart: "2026-07-01", periodEnd: "2026-07-14", checkDate: "2026-07-17", baseRate: "32.0000" },
    { id: "browser-rate-paycheck-base-2", periodStart: "2026-07-15", periodEnd: "2026-07-28", checkDate: "2026-07-31", baseRate: "32.0000" },
    { id: "browser-rate-paycheck-increase-1", periodStart: "2026-08-01", periodEnd: "2026-08-14", checkDate: "2026-08-21", baseRate: "35.0000" },
    { id: "browser-rate-paycheck-increase-2", periodStart: "2026-08-15", periodEnd: "2026-08-28", checkDate: "2026-09-04", baseRate: "35.0000" },
    { id: "browser-rate-paycheck-conflict", periodStart: "2026-09-01", periodEnd: "2026-09-14", checkDate: "2026-09-18", baseRate: "31.0000" },
  ];
  for (const paycheck of paychecks) await createPaycheck(prisma, paycheck);

  await createObservation(prisma, {
    id: "browser-observation-base-primary", paycheckId: paychecks[0].id, row: 1,
    rate: "32.0000", periodStart: paychecks[0].periodStart, periodEnd: paychecks[0].periodEnd,
    classifications: ["FIRST_RATE_CANDIDATE"],
  });
  await createObservation(prisma, {
    id: "browser-observation-base-repeat", paycheckId: paychecks[1].id, row: 1,
    rate: "32.0000", periodStart: paychecks[1].periodStart, periodEnd: paychecks[1].periodEnd,
    classifications: ["REPEATED_SUPPORTING_OBSERVATION"],
  });
  await createObservation(prisma, {
    id: "browser-observation-increase-1", paycheckId: paychecks[2].id, row: 1,
    rate: "35.0000", periodStart: paychecks[2].periodStart, periodEnd: paychecks[2].periodEnd,
    classifications: ["CANDIDATE_INCREASE", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
  });
  await createObservation(prisma, {
    id: "browser-observation-increase-2", paycheckId: paychecks[3].id, row: 1,
    rate: "35.0000", periodStart: paychecks[3].periodStart, periodEnd: paychecks[3].periodEnd,
    classifications: ["CANDIDATE_INCREASE", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
  });
  await createObservation(prisma, {
    id: "browser-observation-decrease", paycheckId: paychecks[4].id, row: 1,
    rate: "31.0000", periodStart: paychecks[4].periodStart, periodEnd: paychecks[4].periodEnd,
    classifications: ["CANDIDATE_DECREASE", "SAME_DATE_CONFLICT", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
  });
  await createObservation(prisma, {
    id: "browser-observation-conflict", paycheckId: paychecks[4].id, row: 2,
    rate: "34.0000", periodStart: paychecks[4].periodStart, periodEnd: paychecks[4].periodEnd,
    classifications: ["SAME_DATE_CONFLICT", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
  });

  if (options.includeVerifiedRate !== false) {
    await prisma.employeePayRate.create({
      data: {
        id: "browser-verified-rate-32",
        employeeId: "browser-owner",
        effectiveFrom: date("2026-07-01"),
        hourlyRate: new Prisma.Decimal("32.0000"),
        sourceNote: "Synthetic verified boundary for isolated browser acceptance.",
        sourcePaycheckId: paychecks[0].id,
        verificationStatus: "VERIFIED",
        provenanceKind: "PAYCHECK",
      },
    });
    await prisma.payRateObservationSupport.createMany({
      data: [
        { id: "browser-support-base-primary", employeePayRateId: "browser-verified-rate-32", observationId: "browser-observation-base-primary", supportKind: "PRIMARY" },
        { id: "browser-support-base-repeat", employeePayRateId: "browser-verified-rate-32", observationId: "browser-observation-base-repeat", supportKind: "REINFORCING" },
      ],
    });
  }

  await createCandidate(prisma, {
    id: "browser-candidate-increase", rate: "35.0000", start: "2026-08-01", end: "2026-08-28",
    observationIds: ["browser-observation-increase-1", "browser-observation-increase-2"],
  });
  await createCandidate(prisma, {
    id: "browser-candidate-decrease", rate: "31.0000", start: "2026-09-01", end: "2026-09-14",
    observationIds: ["browser-observation-decrease"],
  });
  await createCandidate(prisma, {
    id: "browser-candidate-conflict", rate: "34.0000", start: "2026-09-01", end: "2026-09-14",
    observationIds: ["browser-observation-conflict"],
  });
  await prisma.payRateBoundaryCandidate.create({
    data: {
      id: "browser-candidate-missing-evidence",
      employeeId: "browser-owner",
      observedHourlyRate: new Prisma.Decimal("36.0000"),
      earliestEffectiveDate: date("2026-10-01"),
      latestEffectiveDate: date("2026-10-14"),
    },
  });
  await createAffectedWorkDates(prisma);
}
