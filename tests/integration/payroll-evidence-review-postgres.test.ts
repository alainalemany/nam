import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { guardedPhaseADatabaseUrl } from "../helpers/phase-a-postgres-guard";
import { createCorrectionPreviewEnvelope } from "@/features/payroll/preview-evidence";

const previewSecret = "postgres-preview-test-secret".repeat(2);

const injected = vi.hoisted(() => ({ prisma: undefined as unknown }));
vi.mock("@/lib/prisma", () => ({ prisma: injected.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/features/payroll/auth", () => ({
  requirePayrollPrincipal: vi.fn(async () => ({ employeeId: "correction-employee", expiresAt: 4_000_000_000 })),
  clearPayrollSession: vi.fn(),
  establishPayrollSession: vi.fn(),
  payrollPreviewSigningSecret: () => previewSecret,
}));

const databaseUrl = guardedPhaseADatabaseUrl();
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
let prisma: PrismaClient;
let persistence: typeof import("@/features/payroll/evidence-review-persistence");
let payrollActions: typeof import("@/features/payroll/actions");
let timesheetActions: typeof import("@/features/timesheets/actions");

const actor = { employeeId: "reviewer-employee", displayName: "Original Reviewer", employeeCode: "REV-1" };
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
let tokenCounter = 0;
const token = () => `123e4567-e89b-42d3-a456-${String(++tokenCounter).padStart(12, "0")}`;

async function waitForAdvisoryWaiters(expected: number) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event = 'advisory'
    `;
    if (Number(count) >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected ${expected} transaction(s) waiting on an advisory lock.`);
}

async function holdEvidenceLock(scope: "paycheck" | "timesheet", key: string) {
  let release!: () => void;
  let reached!: () => void;
  const held = new Promise<void>((resolve) => { reached = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  const transaction = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(CAST(${`nam-payroll:${scope}:${key}`} AS text), 0::bigint)
      )
    `;
    reached();
    await released;
  });
  await held;
  return { release, transaction };
}

async function clearFixtures() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TimesheetIdentityReviewEvent",
      "PayRateEvidenceReviewEvent",
      "Paycheck",
      "PayrollPeriod",
      "EmployeePayRate",
      "WorkAllocationSupportPerson",
      "WorkAllocation",
      "DailyTimeEntry",
      "WeeklyTimesheet",
      "TimesheetWorkCode",
      "TimesheetWorkOrder",
      "TimesheetSupportPerson",
      "AssignmentCrewMember",
      "DailyAssignment",
      "WeeklySchedule",
      "Employee"
    RESTART IDENTITY CASCADE
  `);
}

async function createEmployee(id: string, displayName: string, isActive = true) {
  return prisma.employee.create({
    data: { id, displayName, employeeCode: `${id}-code`, isActive },
  });
}

async function createTimesheet(id: string, key: string, week = "2026-06-01") {
  return prisma.weeklyTimesheet.create({
    data: {
      id,
      payrollWeekStartDate: date(week),
      payrollWeekEndDate: new Date(date(week).getTime() + 6 * 86_400_000),
      primaryEmployeeDisplayName: `Historical ${key}`,
      primaryEmployeeKey: key,
      primaryEmployeeIdentityStatus: "NEEDS_REVIEW",
      identityVersion: 1,
    },
  });
}

async function createPaycheck(
  id: string,
  employeeId: string,
  periodStart = "2026-06-01",
  rate = "33.1500",
  reviewStatus: "CONFIRMED" | "NEEDS_REVIEW" = "CONFIRMED",
) {
  const period = await prisma.payrollPeriod.create({
    data: {
      id: `${id}-period`,
      employeeId,
      periodStart: date(periodStart),
      periodEnd: new Date(date(periodStart).getTime() + 6 * 86_400_000),
      expectedCheckDate: new Date(date(periodStart).getTime() + 9 * 86_400_000),
    },
  });
  return prisma.paycheck.create({
    data: {
      id,
      employeeId,
      payrollPeriodId: period.id,
      checkDate: new Date(date(periodStart).getTime() + 9 * 86_400_000),
      regularPaidMinutes: 2400,
      overtimePaidMinutes: 0,
      baseRate: new Prisma.Decimal(rate),
      regularEarnings: new Prisma.Decimal("1326.00"),
      grossCashPay: new Prisma.Decimal("1326.00"),
      netPay: new Prisma.Decimal("1000.00"),
      sourceFingerprint: createHash("sha256").update(id).digest("hex"),
      parserVersion: "review-test-v1",
      reviewStatus,
    },
  });
}

async function correctionForm(
  paycheckId: string,
  overrides: Record<string, string> = {},
) {
  const paycheck = await prisma.paycheck.findUniqueOrThrow({
    where: { id: paycheckId },
    include: { payrollPeriod: true },
  });
  const periodStart = paycheck.payrollPeriod.periodStart.toISOString().slice(0, 10);
  const periodEnd = paycheck.payrollPeriod.periodEnd.toISOString().slice(0, 10);
  const payload = {
    importMode: "CORRECTION",
    fingerprint: paycheck.sourceFingerprint,
    parserVersion: paycheck.parserVersion,
    periodStart,
    periodEnd,
    checkDate: paycheck.checkDate.toISOString().slice(0, 10),
    regularHours: String(paycheck.regularPaidMinutes / 60),
    overtimeHours: String(paycheck.overtimePaidMinutes / 60),
    baseRate: paycheck.baseRate?.toString() ?? "",
    regularEarnings: paycheck.regularEarnings.toString(),
    overtimeBaseEarnings: paycheck.overtimeBaseEarnings.toString(),
    overtimePremiumEarnings: paycheck.overtimePremiumEarnings.toString(),
    otherCashEarnings: paycheck.otherCashEarnings.toString(),
    grossCashPay: paycheck.grossCashPay.toString(),
    noncashImputedEarnings: paycheck.noncashImputedEarnings.toString(),
    preTaxDeductions: paycheck.preTaxDeductions.toString(),
    employeeTaxes: paycheck.employeeTaxes.toString(),
    postTaxDeductions: paycheck.postTaxDeductions.toString(),
    adjustments: paycheck.adjustments.toString(),
    netPay: paycheck.netPay.toString(),
    notes: paycheck.notes ?? "Synthetic correction",
    warnings: [],
  };
  const evidenceEnvelope = createCorrectionPreviewEnvelope("correction-employee", {
    paycheckId,
    recordUpdatedAt: paycheck.updatedAt.toISOString(),
    fingerprint: paycheck.sourceFingerprint,
    parserVersion: paycheck.parserVersion,
    periodStart,
    periodEnd,
    regularHours: payload.regularHours,
    baseRate: payload.baseRate,
    regularEarnings: payload.regularEarnings,
  }, previewSecret);
  const form = new FormData();
  form.set("paycheckId", paycheckId);
  form.set("payload", JSON.stringify({ ...payload, evidenceEnvelope, ...overrides }));
  return form;
}

async function createRate(id: string, employeeId: string, amount = "33.1500") {
  return prisma.employeePayRate.create({
    data: {
      id,
      employeeId,
      effectiveFrom: date("2026-06-01"),
      hourlyRate: new Prisma.Decimal(amount),
      sourceNote: "Synthetic quarantined evidence",
      verificationStatus: "NEEDS_REVIEW",
      provenanceKind: "UNKNOWN",
      evidenceVersion: 1,
    },
  });
}

function existingTimesheetSaveForm(timesheet: { payrollWeekStartDate: Date; primaryEmployeeId: string | null }) {
  const week = timesheet.payrollWeekStartDate.toISOString().slice(0, 10);
  const form = new FormData();
  form.set("payload", JSON.stringify({
    payrollWeekStartDate: week,
    primaryEmployeeId: timesheet.primaryEmployeeId,
    primaryEmployeeDisplayName: "Ignored client snapshot",
    entries: [{
      workDate: week,
      clockIn: "08:00",
      clockOut: "16:00",
      unpaidBreakMinutes: 30,
      primaryEquipmentId: "",
      workScheduleDailyAssignmentId: "",
      notes: "Concurrent ordinary save won only if review had not committed.",
      allocations: [{
        sequence: 1,
        workCodeId: "save-race-work-code",
        workOrderId: "",
        allocatedMinutes: 450,
        supportPersonIds: [],
        notes: "Synthetic allocation",
      }],
    }],
  }));
  return form;
}

describePostgres("Payroll Package 2A evidence review", () => {
  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    injected.prisma = prisma;
    persistence = await import("@/features/payroll/evidence-review-persistence");
    payrollActions = await import("@/features/payroll/actions");
    timesheetActions = await import("@/features/timesheets/actions");
  });

  beforeEach(async () => {
    tokenCounter = 0;
    await clearFixtures();
    await createEmployee(actor.employeeId, actor.displayName);
  });

  afterAll(async () => prisma?.$disconnect());

  it("installs migration 37 constraints, trusted uniqueness, restrictive keys, and immutable triggers", async () => {
    const migration = await prisma.$queryRaw<Array<{ checksum: string }>>`
      SELECT checksum FROM "_prisma_migrations"
      WHERE migration_name = '20261015000300_payroll_evidence_review_history'
        AND finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(migration).toHaveLength(1);
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'WeeklyTimesheet_trusted_employee_week_key',
        'TimesheetIdentityReviewEvent_target_sequence_key',
        'PayRateEvidenceReviewEvent_target_sequence_key'
      )
    `;
    expect(indexes).toHaveLength(3);
    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger
      WHERE tgname IN (
        'TimesheetIdentityReviewEvent_immutable', 'PayRateEvidenceReviewEvent_immutable',
        'TimesheetIdentityReviewEvent_validate_insert', 'PayRateEvidenceReviewEvent_validate_insert'
      )
        AND NOT tgisinternal
    `;
    expect(triggers).toHaveLength(4);
    const restrictiveKeys = await prisma.$queryRaw<Array<{ conname: string; action: string }>>`
      SELECT conname, confdeltype::text AS action FROM pg_constraint
      WHERE conname IN (
        'TimesheetIdentityReviewEvent_timesheet_fkey',
        'TimesheetIdentityReviewEvent_previousEmployee_fkey',
        'TimesheetIdentityReviewEvent_newEmployee_fkey',
        'TimesheetIdentityReviewEvent_reviewer_fkey',
        'PayRateEvidenceReviewEvent_rate_fkey',
        'PayRateEvidenceReviewEvent_previousPaycheck_fkey',
        'PayRateEvidenceReviewEvent_newPaycheck_fkey',
        'PayRateEvidenceReviewEvent_reviewer_fkey',
        'PayRateEvidenceReviewEvent_initiator_fkey'
      )
    `;
    expect(restrictiveKeys).toHaveLength(9);
    expect(restrictiveKeys.every((key) => key.action === "r")).toBe(true);
  });

  it("rejects malformed or target-inconsistent audit INSERT attempts", async () => {
    const timesheet = await createTimesheet("timesheet-invalid-event", "invalid-event");
    await expect(prisma.timesheetIdentityReviewEvent.create({ data: {
      weeklyTimesheetId: timesheet.id, sequence: 1, decisionKind: "REVIEWED_UNASSIGNED",
      previousStatus: "NEEDS_REVIEW", newStatus: "REVIEWED_UNASSIGNED",
      previousVersion: 1, newVersion: 2, reviewerEmployeeId: actor.employeeId,
      reviewerDisplayNameSnapshot: actor.displayName, reason: "Fabricated event must fail.",
      requestToken: token(), requestDigest: "a".repeat(64),
    } })).rejects.toThrow(/does not match target state/);

    await createEmployee("invalid-rate-employee", "Invalid Rate Employee");
    const rate = await createRate("invalid-rate-event", "invalid-rate-employee");
    await expect(prisma.payRateEvidenceReviewEvent.create({ data: {
      employeePayRateId: rate.id, sequence: 1, decisionKind: "VERIFIED_INDEPENDENT",
      attributionKind: "OWNER_REVIEWER", previousStatus: "NEEDS_REVIEW", newStatus: "EXCLUDED",
      previousProvenanceKind: "UNKNOWN", newProvenanceKind: "UNKNOWN",
      previousVersion: 1, newVersion: 2, reviewerEmployeeId: actor.employeeId,
      reviewerDisplayNameSnapshot: actor.displayName, reason: "Invalid decision combination.",
      requestToken: token(), requestDigest: "b".repeat(64),
    } })).rejects.toThrow();
  });

  it("verifies explicit duplicate-name and inactive Employees while preserving Timesheet snapshots", async () => {
    await createEmployee("employee-duplicate-a", "Same Name");
    await createEmployee("employee-duplicate-b", "Same Name", false);
    const timesheet = await createTimesheet("timesheet-inactive", "same name snapshot");
    const result = await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER",
      timesheetId: timesheet.id,
      expectedIdentityVersion: 1,
      employeeId: "employee-duplicate-b",
      reason: "The retained shift roster identifies the inactive historical Employee.",
      sourceEvidenceReference: "Shift roster dated 2026-06-01",
      requestToken: token(),
    }, { client: prisma });
    expect(result).toMatchObject({ newState: "OWNER_VERIFIED", newVersion: 2, idempotencyReplay: false });
    const saved = await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: timesheet.id } });
    expect(saved).toMatchObject({
      primaryEmployeeId: "employee-duplicate-b",
      primaryEmployeeDisplayName: "Historical same name snapshot",
      primaryEmployeeKey: "same name snapshot",
      identityVersion: 2,
    });
    const event = await prisma.timesheetIdentityReviewEvent.findFirstOrThrow({ where: { weeklyTimesheetId: timesheet.id } });
    expect(event).toMatchObject({ reviewerDisplayNameSnapshot: actor.displayName, newEmployeeDisplayNameSnapshot: "Same Name" });
  });

  it("supports reviewed-unassigned, owner verification, correction, and reopening with immutable history", async () => {
    await createEmployee("employee-a", "Employee A");
    await createEmployee("employee-b", "Employee B");
    const timesheet = await createTimesheet("timesheet-transitions", "transition snapshot");
    const unassigned = await persistence.reviewTimesheetIdentity(actor, {
      decision: "REVIEW_UNASSIGNED", timesheetId: timesheet.id, expectedIdentityVersion: 1,
      reason: "Available records do not establish ownership.", requestToken: token(),
    }, { client: prisma });
    const verified = await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: unassigned.newVersion,
      employeeId: "employee-a", reason: "A later roster establishes ownership.", requestToken: token(),
    }, { client: prisma });
    const corrected = await persistence.reviewTimesheetIdentity(actor, {
      decision: "CORRECT_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: verified.newVersion,
      employeeId: "employee-b", reason: "The roster Employee code was corrected.", requestToken: token(),
    }, { client: prisma });
    await persistence.reviewTimesheetIdentity(actor, {
      decision: "REOPEN_UNCERTAINTY", timesheetId: timesheet.id, expectedIdentityVersion: corrected.newVersion,
      reason: "Conflicting source material requires renewed review.", requestToken: token(),
    }, { client: prisma });
    const events = await prisma.timesheetIdentityReviewEvent.findMany({ where: { weeklyTimesheetId: timesheet.id }, orderBy: { sequence: "asc" } });
    expect(events.map((event) => event.decisionKind)).toEqual(["REVIEWED_UNASSIGNED", "OWNER_VERIFIED", "OWNER_CORRECTED", "REOPENED_UNCERTAINTY"]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("enforces trusted Employee/week uniqueness and concurrent compare-and-swap", async () => {
    await createEmployee("employee-owner", "Canonical Owner");
    const first = await createTimesheet("timesheet-first", "snapshot-one");
    const second = await createTimesheet("timesheet-second", "snapshot-two");
    await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: first.id, expectedIdentityVersion: 1,
      employeeId: "employee-owner", reason: "First explicit source.", requestToken: token(),
    }, { client: prisma });
    await expect(persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: second.id, expectedIdentityVersion: 1,
      employeeId: "employee-owner", reason: "Conflicting second source.", requestToken: token(),
    }, { client: prisma })).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });

    const concurrent = await createTimesheet("timesheet-concurrent", "concurrent");
    const requests = [token(), token()].map((requestToken) => persistence.reviewTimesheetIdentity(actor, {
      decision: "REVIEW_UNASSIGNED" as const,
      timesheetId: concurrent.id,
      expectedIdentityVersion: 1,
      reason: "Concurrent review.",
      requestToken,
    }, { client: prisma }));
    const settled = await Promise.allSettled(requests);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("replays identical submissions, rejects changed payloads, and rolls back failed audit insertion", async () => {
    const timesheet = await createTimesheet("timesheet-idempotent", "idempotent");
    const requestToken = token();
    const input = {
      decision: "REVIEW_UNASSIGNED" as const,
      timesheetId: timesheet.id,
      expectedIdentityVersion: 1,
      reason: "No authoritative owner evidence exists.",
      requestToken,
    };
    const first = await persistence.reviewTimesheetIdentity(actor, input, { client: prisma });
    const replay = await persistence.reviewTimesheetIdentity(actor, input, { client: prisma });
    expect(replay).toMatchObject({ auditEventId: first.auditEventId, idempotencyReplay: true });
    await expect(persistence.reviewTimesheetIdentity(actor, { ...input, reason: "Changed reason" }, { client: prisma }))
      .rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_TOKEN" });
    expect(await prisma.timesheetIdentityReviewEvent.count({ where: { weeklyTimesheetId: timesheet.id } })).toBe(1);

    const tokenRaceA = await createTimesheet("timesheet-token-race-a", "token-race-a");
    const tokenRaceB = await createTimesheet("timesheet-token-race-b", "token-race-b");
    const sharedToken = token();
    const tokenRace = await Promise.allSettled([tokenRaceA, tokenRaceB].map((target) =>
      persistence.reviewTimesheetIdentity(actor, {
        decision: "REVIEW_UNASSIGNED", timesheetId: target.id, expectedIdentityVersion: 1,
        reason: "Concurrent token reuse test.", requestToken: sharedToken,
      }, { client: prisma })));
    expect(tokenRace.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(tokenRace.filter((item) => item.status === "rejected" && item.reason?.code === "INVALID_IDEMPOTENCY_TOKEN")).toHaveLength(1);
    expect(await prisma.timesheetIdentityReviewEvent.count({ where: { requestToken: sharedToken } })).toBe(1);

    const rollback = await createTimesheet("timesheet-rollback", "rollback");
    await expect(persistence.reviewTimesheetIdentity(actor, {
      ...input, timesheetId: rollback.id, requestToken: token(),
    }, { client: prisma, hooks: { afterTargetUpdate: async () => { throw new Error("forced-event-failure"); } } }))
      .rejects.toThrow("forced-event-failure");
    expect(await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: rollback.id } })).toMatchObject({ identityVersion: 1, primaryEmployeeIdentityStatus: "NEEDS_REVIEW" });
    expect(await prisma.timesheetIdentityReviewEvent.count({ where: { weeklyTimesheetId: rollback.id } })).toBe(0);
  });

  it("verifies matching confirmed Paycheck provenance and rejects mismatches", async () => {
    await createEmployee("rate-employee", "Rate Employee");
    await createEmployee("other-employee", "Other Employee");
    await createPaycheck("paycheck-good", "rate-employee");
    await createPaycheck("paycheck-unconfirmed", "rate-employee", "2026-07-01", "33.1500", "NEEDS_REVIEW");
    await createPaycheck("paycheck-other", "other-employee");
    await createPaycheck("paycheck-wrong-date", "rate-employee", "2026-08-01");
    const rate = await createRate("rate-paycheck", "rate-employee");
    const result = await persistence.reviewPayRateEvidence(actor, {
      decision: "VERIFY_PAYCHECK", rateId: rate.id, expectedEvidenceVersion: 1,
      sourcePaycheckId: "paycheck-good", reason: "Explicitly reviewed against confirmed Workday evidence.", requestToken: token(),
    }, { client: prisma });
    expect(result).toMatchObject({ newState: "VERIFIED", newVersion: 2 });
    expect(await prisma.employeePayRate.findUniqueOrThrow({ where: { id: rate.id } })).toMatchObject({ provenanceKind: "PAYCHECK", sourcePaycheckId: "paycheck-good" });

    for (const [id, paycheckId, amount] of [
      ["rate-unconfirmed", "paycheck-unconfirmed", "33.1500"],
      ["rate-other", "paycheck-other", "33.1500"],
      ["rate-amount", "paycheck-good", "34.0000"],
      ["rate-date", "paycheck-wrong-date", "33.1500"],
    ] as const) {
      const candidate = await createRate(id, "rate-employee", amount);
      await expect(persistence.reviewPayRateEvidence(actor, {
        decision: "VERIFY_PAYCHECK", rateId: candidate.id, expectedEvidenceVersion: 1,
        sourcePaycheckId: paycheckId, reason: "Mismatch test.", requestToken: token(),
      }, { client: prisma })).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    }
  });

  it("verifies independent evidence and atomically resolves every same-date competitor", async () => {
    await createEmployee("slot-employee", "Slot Employee");
    const independent = await createRate("rate-independent", "slot-employee");
    const verified = await persistence.reviewPayRateEvidence(actor, {
      decision: "VERIFY_INDEPENDENT", rateId: independent.id, expectedEvidenceVersion: 1,
      reason: "Reviewed independent wage notice.", sourceEvidenceReference: "Wage notice dated 2026-06-01",
      requestToken: token(),
    }, { client: prisma });
    expect(verified.newState).toBe("VERIFIED");

    const competitor = await createRate("rate-competitor", "slot-employee", "34.0000");
    const resolutionToken = token();
    const resolution = await persistence.resolvePayRateEvidenceCompetitors(actor, {
      decision: "RESOLVE_COMPETITORS",
      selectedRateId: competitor.id,
      selectedExpectedEvidenceVersion: 1,
      selectedProvenance: "INDEPENDENT",
      competitors: [{ rateId: independent.id, expectedEvidenceVersion: 2, disposition: "EXCLUDED" }],
      reason: "The later independent source disproves the older evidence.",
      sourceEvidenceReference: "Corrected wage notice dated 2026-06-01",
      requestToken: resolutionToken,
    }, { client: prisma });
    expect(resolution.newState).toBe("VERIFIED");
    const rows = await prisma.employeePayRate.findMany({ where: { employeeId: "slot-employee" }, orderBy: { id: "asc" } });
    expect(rows.map((row) => [row.id, row.verificationStatus])).toEqual([
      ["rate-competitor", "VERIFIED"],
      ["rate-independent", "EXCLUDED"],
    ]);
    expect(await prisma.payRateEvidenceReviewEvent.count({ where: { requestToken: resolutionToken } })).toBe(2);
    expect(await prisma.payRateEvidenceReviewEvent.count()).toBe(3);
  });

  it("rejects stale rate review and replays one immutable rate decision", async () => {
    await createEmployee("rate-idempotent-employee", "Rate Idempotent Employee");
    const rate = await createRate("rate-idempotent", "rate-idempotent-employee");
    const requestToken = token();
    const input = {
      decision: "VERIFY_INDEPENDENT" as const,
      rateId: rate.id,
      expectedEvidenceVersion: 1,
      reason: "Reviewed against an independent wage notice.",
      sourceEvidenceReference: "Wage notice dated 2026-06-01",
      requestToken,
    };
    const first = await persistence.reviewPayRateEvidence(actor, input, { client: prisma });
    expect(await persistence.reviewPayRateEvidence(actor, input, { client: prisma }))
      .toMatchObject({ auditEventId: first.auditEventId, idempotencyReplay: true });
    await expect(persistence.reviewPayRateEvidence(actor, { ...input, requestToken: token() }, { client: prisma }))
      .rejects.toMatchObject({ code: "STALE_REVIEW" });
    await expect(persistence.reviewPayRateEvidence(actor, { ...input, reason: "Changed payload" }, { client: prisma }))
      .rejects.toMatchObject({ code: "INVALID_IDEMPOTENCY_TOKEN" });
    expect(await prisma.payRateEvidenceReviewEvent.count({ where: { employeePayRateId: rate.id } })).toBe(1);
  });

  it("makes verified identity and rate evidence available on the next Payroll read", async () => {
    await createEmployee("recalc-employee", "Recalculation Employee");
    const timesheet = await createTimesheet("timesheet-recalc", "recalc", "2026-06-01");
    await prisma.weeklyTimesheet.update({
      where: { id: timesheet.id },
      data: {
        status: "COMPLETED",
        workedMinutesTotal: 600,
        regularMinutesTotal: 600,
        entries: { create: {
          id: "entry-recalc", workDate: date("2026-06-02"), clockIn: "07:00", clockOut: "17:00",
          unpaidBreakMinutes: 0, workedMinutes: 600, regularMinutes: 600, overtimeMinutes: 0,
          primaryEquipmentDisplayNameSnapshot: "Synthetic Equipment",
          primaryEquipmentNumberSnapshot: "TEST-1", primaryEquipmentCategorySnapshot: "DRAGLINE",
          primaryMineNameSnapshot: "Synthetic Mine", primaryCityNameSnapshot: "Synthetic City",
          primaryCityStateSnapshot: "WY",
        } },
      },
    });
    const rate = await createRate("rate-recalc", "recalc-employee");
    await persistence.reviewPayRateEvidence(actor, {
      decision: "VERIFY_INDEPENDENT", rateId: rate.id, expectedEvidenceVersion: 1,
      reason: "Reviewed wage notice.", sourceEvidenceReference: "Wage notice dated 2026-06-01",
      requestToken: token(),
    }, { client: prisma });
    const { getPayrollDashboardData } = await import("@/features/payroll/data");
    expect((await getPayrollDashboardData("recalc-employee", "2026-06")).summary.pendingMinutes).toBe(0);
    await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: 1,
      employeeId: "recalc-employee", reason: "Reviewed shift roster.", requestToken: token(),
    }, { client: prisma });
    expect((await getPayrollDashboardData("recalc-employee", "2026-06")).summary).toMatchObject({
      pendingMinutes: 600, pendingGrossStatus: "AVAILABLE", pendingGross: "$331.50",
    });
  });

  it("rejects direct audit UPDATE and DELETE and retains reviewer snapshots after rename", async () => {
    const timesheet = await createTimesheet("timesheet-immutable", "immutable");
    const result = await persistence.reviewTimesheetIdentity(actor, {
      decision: "REVIEW_UNASSIGNED", timesheetId: timesheet.id, expectedIdentityVersion: 1,
      reason: "No owner can be established.", requestToken: token(),
    }, { client: prisma });
    await prisma.employee.update({ where: { id: actor.employeeId }, data: { displayName: "Renamed Reviewer" } });
    const event = await prisma.timesheetIdentityReviewEvent.findUniqueOrThrow({ where: { id: result.auditEventId } });
    expect(event.reviewerDisplayNameSnapshot).toBe("Original Reviewer");
    await expect(prisma.$executeRawUnsafe(`UPDATE "TimesheetIdentityReviewEvent" SET "reason" = 'tampered' WHERE "id" = '${result.auditEventId}'`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "TimesheetIdentityReviewEvent" WHERE "id" = '${result.auditEventId}'`)).rejects.toThrow(/append-only/);

    await createEmployee("immutable-rate-employee", "Immutable Rate Employee");
    const rate = await createRate("immutable-rate", "immutable-rate-employee");
    const rateResult = await persistence.reviewPayRateEvidence(actor, {
      decision: "VERIFY_INDEPENDENT", rateId: rate.id, expectedEvidenceVersion: 1,
      reason: "Reviewed independent source.", sourceEvidenceReference: "Wage notice dated 2026-06-01",
      requestToken: token(),
    }, { client: prisma });
    await expect(prisma.$executeRawUnsafe(`UPDATE "PayRateEvidenceReviewEvent" SET "reason" = 'tampered' WHERE "id" = '${rateResult.auditEventId}'`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "PayRateEvidenceReviewEvent" WHERE "id" = '${rateResult.auditEventId}'`)).rejects.toThrow(/append-only/);
  });

  it("audits Paycheck correction supersession and replacement atomically", async () => {
    await createEmployee("correction-employee", "Correction Owner");
    const paycheck = await createPaycheck("correction-paycheck", "correction-employee");
    const rate = await createRate("correction-rate", "correction-employee");
    await prisma.employeePayRate.update({
      where: { id: rate.id },
      data: { verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourcePaycheckId: paycheck.id },
    });
    const form = await correctionForm(paycheck.id);
    await expect(payrollActions.correctPaycheckAction({ status: "idle", message: "" }, form))
      .resolves.toMatchObject({ status: "saved", rateEvidence: "VERIFIED" });

    const oldRate = await prisma.employeePayRate.findUniqueOrThrow({ where: { id: rate.id } });
    expect(oldRate).toMatchObject({ verificationStatus: "SUPERSEDED", evidenceVersion: 2 });
    const replacement = await prisma.employeePayRate.findFirstOrThrow({
      where: { sourcePaycheckId: paycheck.id, verificationStatus: "VERIFIED" },
      orderBy: { createdAt: "desc" },
    });
    const events = await prisma.payRateEvidenceReviewEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { employeePayRateId: "asc" }],
    });
    const correctionEvents = events.filter((event) =>
      event.decisionKind === "PAYCHECK_CORRECTION_SUPERSEDED" || event.decisionKind === "PAYCHECK_CORRECTION_CREATED");
    expect(correctionEvents).toHaveLength(2);
    expect(correctionEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ employeePayRateId: rate.id, previousVersion: 1, newVersion: 2, reviewerEmployeeId: null, initiatedByEmployeeId: "correction-employee" }),
      expect.objectContaining({ employeePayRateId: replacement.id, previousStatus: null, previousVersion: 0, newVersion: 2, reviewerEmployeeId: null, initiatedByEmployeeId: "correction-employee" }),
    ]));
    expect(new Set(correctionEvents.map((event) => event.requestToken)).size).toBe(1);
  });

  it("rolls back the Paycheck correction when a required system event cannot be inserted", async () => {
    await createEmployee("correction-employee", "Correction Owner");
    const paycheck = await createPaycheck("rollback-correction-paycheck", "correction-employee");
    const rate = await createRate("rollback-correction-rate", "correction-employee");
    await prisma.employeePayRate.update({
      where: { id: rate.id },
      data: { verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourcePaycheckId: paycheck.id },
    });
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "reject_test_correction_event"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."decisionKind" IN ('PAYCHECK_CORRECTION_SUPERSEDED', 'PAYCHECK_CORRECTION_CREATED') THEN
          RAISE EXCEPTION 'forced correction event failure';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "reject_test_correction_event_trigger"
        BEFORE INSERT ON "PayRateEvidenceReviewEvent"
        FOR EACH ROW EXECUTE FUNCTION "reject_test_correction_event"()
    `);
    try {
      const form = await correctionForm(paycheck.id);
      await expect(payrollActions.correctPaycheckAction({ status: "idle", message: "" }, form))
        .resolves.toMatchObject({ status: "error" });
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "reject_test_correction_event_trigger" ON "PayRateEvidenceReviewEvent"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "reject_test_correction_event"()`);
    }
    expect(await prisma.employeePayRate.findUniqueOrThrow({ where: { id: rate.id } }))
      .toMatchObject({ verificationStatus: "VERIFIED", evidenceVersion: 1, hourlyRate: new Prisma.Decimal("33.1500") });
    expect(await prisma.paycheck.findUniqueOrThrow({ where: { id: paycheck.id } }))
      .toMatchObject({ baseRate: new Prisma.Decimal("33.1500") });
    expect(await prisma.payRateEvidenceReviewEvent.count()).toBe(0);
  });

  it("serializes Timesheet review against deletion with a controlled advisory-lock barrier", async () => {
    await createEmployee("timesheet-owner", "Timesheet Owner");
    const timesheet = await createTimesheet("timesheet-delete-race", "delete-race");
    const verified = await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: 1,
      employeeId: "timesheet-owner", reason: "Synthetic ownership evidence.", requestToken: token(),
    }, { client: prisma });
    const blocker = await holdEvidenceLock("timesheet", timesheet.id);
    const review = persistence.reviewTimesheetIdentity(actor, {
      decision: "REOPEN_UNCERTAINTY", timesheetId: timesheet.id, expectedIdentityVersion: verified.newVersion,
      reason: "Synthetic conflicting evidence.", requestToken: token(),
    }, { client: prisma });
    const deletion = timesheetActions.deleteWeeklyTimesheetAction(
      timesheet.id, { ok: false, message: "" }, new FormData(),
    );
    await waitForAdvisoryWaiters(2);
    blocker.release();
    const [reviewOutcome, deletionOutcome] = await Promise.allSettled([review, deletion]);
    await blocker.transaction;

    const persisted = await prisma.weeklyTimesheet.findUnique({ where: { id: timesheet.id } });
    const reopenEvents = await prisma.timesheetIdentityReviewEvent.count({
      where: { weeklyTimesheetId: timesheet.id, decisionKind: "REOPENED_UNCERTAINTY" },
    });
    expect(reviewOutcome.status === "fulfilled" || deletionOutcome.status === "fulfilled").toBe(true);
    if (persisted) {
      expect(persisted).toMatchObject({ primaryEmployeeIdentityStatus: "NEEDS_REVIEW", identityVersion: 3 });
      expect(reopenEvents).toBe(1);
    } else {
      expect(reopenEvents).toBe(0);
      expect(reviewOutcome.status).toBe("rejected");
    }
  });

  it("serializes Timesheet identity review against completion and reopening", async () => {
    await createEmployee("timesheet-owner", "Timesheet Owner");
    for (const lifecycle of ["complete", "reopen"] as const) {
      const timesheet = await createTimesheet(`timesheet-${lifecycle}-race`, `${lifecycle}-race`, lifecycle === "complete" ? "2026-06-01" : "2026-07-01");
      const verified = await persistence.reviewTimesheetIdentity(actor, {
        decision: "VERIFY_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: 1,
        employeeId: "timesheet-owner", reason: "Synthetic ownership evidence.", requestToken: token(),
      }, { client: prisma });
      if (lifecycle === "reopen") {
        await prisma.weeklyTimesheet.update({ where: { id: timesheet.id }, data: { status: "COMPLETED" } });
      }
      const blocker = await holdEvidenceLock("timesheet", timesheet.id);
      const review = persistence.reviewTimesheetIdentity(actor, {
        decision: "REOPEN_UNCERTAINTY", timesheetId: timesheet.id, expectedIdentityVersion: verified.newVersion,
        reason: "Synthetic lifecycle race.", requestToken: token(),
      }, { client: prisma });
      const lifecycleMutation = lifecycle === "complete"
        ? timesheetActions.completeWeeklyTimesheetAction(timesheet.id, { ok: false, message: "" }, new FormData())
        : timesheetActions.reopenWeeklyTimesheetAction(timesheet.id, { ok: false, message: "" }, new FormData());
      await waitForAdvisoryWaiters(2);
      blocker.release();
      await Promise.allSettled([review, lifecycleMutation]);
      await blocker.transaction;

      const persisted = await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: timesheet.id } });
      expect(persisted).toMatchObject({ primaryEmployeeIdentityStatus: "NEEDS_REVIEW", identityVersion: 3 });
      expect(await prisma.timesheetIdentityReviewEvent.count({
        where: { weeklyTimesheetId: timesheet.id, decisionKind: "REOPENED_UNCERTAINTY" },
      })).toBe(1);
      if (lifecycle === "reopen") expect(["DRAFT", "COMPLETED"]).toContain(persisted.status);
    }
  });

  it("serializes an ordinary Timesheet save against identity review with a controlled lock barrier", async () => {
    await createEmployee("timesheet-owner", "Timesheet Owner");
    const timesheet = await createTimesheet("timesheet-save-race", "save-race");
    const verified = await persistence.reviewTimesheetIdentity(actor, {
      decision: "VERIFY_OWNER", timesheetId: timesheet.id, expectedIdentityVersion: 1,
      employeeId: "timesheet-owner", reason: "Synthetic ownership evidence.", requestToken: token(),
    }, { client: prisma });
    await prisma.timesheetWorkCode.create({
      data: {
        id: "save-race-work-code",
        code: "SAVE-RACE",
        normalizedCode: "save-race",
        description: "Synthetic save-race work code",
      },
    });
    const entry = await prisma.dailyTimeEntry.create({
      data: {
        id: "save-race-entry",
        weeklyTimesheetId: timesheet.id,
        workDate: timesheet.payrollWeekStartDate,
        clockIn: "07:00",
        clockOut: "15:00",
        unpaidBreakMinutes: 30,
        workedMinutes: 450,
        regularMinutes: 450,
        overtimeMinutes: 0,
        primaryEquipmentId: null,
        primaryEquipmentDisplayNameSnapshot: "Historical equipment",
        primaryEquipmentCategorySnapshot: "OTHER",
        primaryMineNameSnapshot: "Historical mine",
        primaryCityNameSnapshot: "Historical city",
      },
    });
    await prisma.workAllocation.create({
      data: {
        dailyTimeEntryId: entry.id,
        sequence: 1,
        workCodeId: "save-race-work-code",
        workCodeSnapshot: "SAVE-RACE",
        workCodeDescriptionSnapshot: "Synthetic save-race work code",
        allocatedMinutes: 450,
      },
    });
    const trusted = await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: timesheet.id } });
    const blocker = await holdEvidenceLock("timesheet", timesheet.id);
    const review = persistence.reviewTimesheetIdentity(actor, {
      decision: "REOPEN_UNCERTAINTY", timesheetId: timesheet.id, expectedIdentityVersion: verified.newVersion,
      reason: "Synthetic uncertainty discovered during save.", requestToken: token(),
    }, { client: prisma });
    const save = timesheetActions.saveWeeklyTimesheetAction(
      timesheet.id,
      { status: "idle", message: "", fieldErrors: {} },
      existingTimesheetSaveForm(trusted),
    );
    await waitForAdvisoryWaiters(2);
    blocker.release();
    const [reviewOutcome, saveOutcome] = await Promise.allSettled([review, save]);
    await blocker.transaction;

    expect(reviewOutcome.status).toBe("fulfilled");
    expect(saveOutcome.status).toBe("fulfilled");
    const persisted = await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: timesheet.id } });
    expect(persisted).toMatchObject({
      primaryEmployeeIdentityStatus: "NEEDS_REVIEW",
      primaryEmployeeId: null,
      identityVersion: 3,
      primaryEmployeeDisplayName: timesheet.primaryEmployeeDisplayName,
      primaryEmployeeKey: timesheet.primaryEmployeeKey,
    });
    expect(await prisma.timesheetIdentityReviewEvent.count({
      where: { weeklyTimesheetId: timesheet.id, decisionKind: "REOPENED_UNCERTAINTY" },
    })).toBe(1);
    const savedEntry = await prisma.dailyTimeEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect([
      "Concurrent ordinary save won only if review had not committed.",
      null,
    ]).toContain(savedEntry.notes);
  });

  it("rolls back a failed audit-event insert and safely releases a waiting transaction", async () => {
    const timesheet = await createTimesheet("timesheet-event-failure-race", "event-failure-race");
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "reject_test_timesheet_review_event"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."requestToken" = '123e4567-e89b-42d3-a456-000000000001'::uuid THEN
          RAISE EXCEPTION 'forced concurrent audit event failure';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "reject_test_timesheet_review_event_trigger"
        BEFORE INSERT ON "TimesheetIdentityReviewEvent"
        FOR EACH ROW EXECUTE FUNCTION "reject_test_timesheet_review_event"()
    `);
    let releaseFailedInsert!: () => void;
    let updateReached!: () => void;
    const mayInsert = new Promise<void>((resolve) => { releaseFailedInsert = resolve; });
    const reachedUpdate = new Promise<void>((resolve) => { updateReached = resolve; });
    try {
      const failing = persistence.reviewTimesheetIdentity(actor, {
        decision: "REVIEW_UNASSIGNED", timesheetId: timesheet.id, expectedIdentityVersion: 1,
        reason: "This event is deliberately rejected.", requestToken: token(),
      }, {
        client: prisma,
        hooks: { afterTargetUpdate: async () => { updateReached(); await mayInsert; } },
      });
      await reachedUpdate;
      const waiting = persistence.reviewTimesheetIdentity(actor, {
        decision: "REVIEW_UNASSIGNED", timesheetId: timesheet.id, expectedIdentityVersion: 1,
        reason: "This transaction must continue safely after rollback.", requestToken: token(),
      }, { client: prisma });
      await waitForAdvisoryWaiters(1);
      releaseFailedInsert();
      const [failedOutcome, waitingOutcome] = await Promise.allSettled([failing, waiting]);

      expect(failedOutcome.status).toBe("rejected");
      expect(waitingOutcome).toMatchObject({
        status: "fulfilled",
        value: expect.objectContaining({ newState: "REVIEWED_UNASSIGNED", newVersion: 2 }),
      });
      expect(await prisma.weeklyTimesheet.findUniqueOrThrow({ where: { id: timesheet.id } }))
        .toMatchObject({ primaryEmployeeIdentityStatus: "REVIEWED_UNASSIGNED", identityVersion: 2 });
      const events = await prisma.timesheetIdentityReviewEvent.findMany({
        where: { weeklyTimesheetId: timesheet.id }, orderBy: { sequence: "asc" },
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        sequence: 1,
        previousVersion: 1,
        newVersion: 2,
        requestToken: "123e4567-e89b-42d3-a456-000000000002",
      });
    } finally {
      releaseFailedInsert?.();
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "reject_test_timesheet_review_event_trigger" ON "TimesheetIdentityReviewEvent"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "reject_test_timesheet_review_event"()`);
    }
  });

  it("serializes rate review against Paycheck correction with a controlled advisory-lock barrier", async () => {
    await createEmployee("correction-employee", "Correction Owner");
    const paycheck = await createPaycheck("correction-race-paycheck", "correction-employee");
    const rate = await createRate("correction-race-rate", "correction-employee");
    await prisma.employeePayRate.update({
      where: { id: rate.id },
      data: { verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourcePaycheckId: paycheck.id },
    });
    const blocker = await holdEvidenceLock("paycheck", paycheck.id);
    const review = persistence.reviewPayRateEvidence(actor, {
      decision: "REOPEN_REVIEW", rateId: rate.id, expectedEvidenceVersion: 1,
      reason: "Synthetic review race.", requestToken: token(),
    }, { client: prisma });
    const form = await correctionForm(paycheck.id);
    const correction = payrollActions.correctPaycheckAction({ status: "idle", message: "" }, form);
    await waitForAdvisoryWaiters(2);
    blocker.release();
    const [reviewOutcome, correctionOutcome] = await Promise.allSettled([review, correction]);
    await blocker.transaction;

    expect(correctionOutcome).toMatchObject({ status: "fulfilled", value: expect.objectContaining({ status: "saved" }) });
    const rates = await prisma.employeePayRate.findMany({
      where: { employeeId: "correction-employee" }, include: { reviewEvents: true },
    });
    expect(rates.flatMap((item) => item.reviewEvents)).toHaveLength(2);
    expect(rates.filter((item) => item.verificationStatus === "VERIFIED").length).toBeLessThanOrEqual(1);
    expect(rates.some((item) =>
      item.sourcePaycheckId === paycheck.id &&
      ["VERIFIED", "CONFLICT", "SUPERSEDED"].includes(item.verificationStatus)))
      .toBe(true);
    if (reviewOutcome.status === "rejected") {
      expect(reviewOutcome.reason).toMatchObject({ code: "STALE_REVIEW" });
    }
  });

  it("serializes competitor resolution against Paycheck correction without missing history", async () => {
    await createEmployee("correction-employee", "Correction Owner");
    const paycheck = await createPaycheck("resolution-race-paycheck", "correction-employee");
    const linked = await createRate("resolution-race-linked", "correction-employee");
    await prisma.employeePayRate.update({
      where: { id: linked.id },
      data: { verificationStatus: "CONFLICT", provenanceKind: "PAYCHECK", sourcePaycheckId: paycheck.id },
    });
    const selected = await createRate("resolution-race-selected", "correction-employee", "34.0000");
    const blocker = await holdEvidenceLock("paycheck", paycheck.id);
    const resolution = persistence.resolvePayRateEvidenceCompetitors(actor, {
      decision: "RESOLVE_COMPETITORS",
      selectedRateId: selected.id,
      selectedExpectedEvidenceVersion: 1,
      selectedProvenance: "INDEPENDENT",
      sourceEvidenceReference: "Synthetic wage notice.",
      competitors: [{ rateId: linked.id, expectedEvidenceVersion: 1, disposition: "SUPERSEDED" }],
      reason: "Synthetic competitor resolution race.",
      requestToken: token(),
    }, { client: prisma });
    const form = await correctionForm(paycheck.id);
    const correction = payrollActions.correctPaycheckAction({ status: "idle", message: "" }, form);
    await waitForAdvisoryWaiters(2);
    blocker.release();
    const outcomes = await Promise.allSettled([resolution, correction]);
    await blocker.transaction;

    expect(outcomes[1]).toMatchObject({ status: "fulfilled", value: expect.objectContaining({ status: "saved" }) });
    const rates = await prisma.employeePayRate.findMany({
      where: { employeeId: "correction-employee" }, include: { reviewEvents: true },
    });
    for (const rateRow of rates) {
      if (rateRow.evidenceVersion > 1 || rateRow.verificationStatus !== "NEEDS_REVIEW") {
        expect(rateRow.reviewEvents.length).toBeGreaterThan(0);
      }
    }
    expect(rates.filter((item) => item.verificationStatus === "VERIFIED").length).toBeLessThanOrEqual(1);
    expect(rates.some((item) =>
      item.sourcePaycheckId === paycheck.id &&
      ["VERIFIED", "CONFLICT", "SUPERSEDED"].includes(item.verificationStatus)))
      .toBe(true);
  });
});
