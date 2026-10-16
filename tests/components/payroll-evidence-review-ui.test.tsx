import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviewTimesheet: vi.fn(), reviewRate: vi.fn(), resolveRates: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/payroll/evidence-review-actions", () => ({
  reviewTimesheetIdentityAction: mocks.reviewTimesheet,
  reviewPayRateEvidenceAction: mocks.reviewRate,
  resolvePayRateEvidenceCompetitorsAction: mocks.resolveRates,
}));

import { PayRateEvidenceReviewForm, TimesheetIdentityReviewForm } from "@/features/payroll/EvidenceReviewForms";
import { RateReviewTimeline, TimesheetReviewTimeline } from "@/features/payroll/EvidenceReviewTimeline";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "123e4567-e89b-42d3-a456-426614174000") });
  mocks.reviewTimesheet.mockResolvedValue({ ok: true, targetId: "ts-1", newState: "OWNER_VERIFIED", newVersion: 2, auditEventId: "event-1", idempotencyReplay: false });
  mocks.reviewRate.mockResolvedValue({ ok: true, targetId: "rate-1", newState: "VERIFIED", newVersion: 2, auditEventId: "event-2", idempotencyReplay: false });
});

describe("Payroll evidence review UI", () => {
  it("never preselects a candidate and requires explicit confirmation, reason, version, and token", async () => {
    render(<TimesheetIdentityReviewForm timesheet={{ id: "ts-1", identityVersion: 1, primaryEmployeeIdentityStatus: "NEEDS_REVIEW", primaryEmployeeId: null }} employees={[{ id: "employee-1", displayName: "Alex Doe", employeeCode: "A1", isActive: true }, { id: "employee-2", displayName: "Alex Doe", employeeCode: "A2", isActive: false }]} />);
    fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "VERIFY_OWNER" } });
    expect(screen.getByLabelText(/^Canonical Employee/)).toHaveValue("");
    expect(screen.getByText(/Historical candidates are never preselected/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Alex Doe · A1 · employee-1/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Alex Doe · A2 · employee-2 · Inactive/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Canonical Employee/), { target: { value: "employee-2" } });
    expect(screen.getByText(/Inactive historical Employee/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Reviewed synthetic wage records." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed change" }));
    expect(mocks.reviewTimesheet).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm this change")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(mocks.reviewTimesheet).toHaveBeenCalledOnce());
    const payload = JSON.parse((mocks.reviewTimesheet.mock.calls[0][1] as FormData).get("payload") as string);
    expect(payload).toMatchObject({ timesheetId: "ts-1", expectedIdentityVersion: 1, employeeId: "employee-2", requestToken: "123e4567-e89b-42d3-a456-426614174000" });
  });

  it("requires an independent reference and shows every competitor disposition before atomic resolution", async () => {
    render(<PayRateEvidenceReviewForm rate={{ id: "rate-1", evidenceVersion: 3, verificationStatus: "CONFLICT", provenanceKind: "UNKNOWN", sourcePaycheckId: null, hourlyRate: "31.2500" }} paychecks={[]} competitors={[{ id: "rate-2", evidenceVersion: 2, verificationStatus: "VERIFIED", hourlyRate: "30.0000" }]} />);
    fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "VERIFY_INDEPENDENT" } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "Owner reviewed wage notice." } });
    expect(screen.getByRole("button", { name: "Review proposed change" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Evidence reference/), { target: { value: "Wage notice 2026-10-01 #SYN" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Resolve every active competitor/ }));
    fireEvent.change(screen.getByLabelText(/30.0000 · Verified/), { target: { value: "EXCLUDED" } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed change" }));
    expect(screen.getByText("rate-2: EXCLUDED")).toBeInTheDocument();
  });

  it("preserves one idempotency token when retrying the same network-failed submission", async () => {
    mocks.reviewTimesheet.mockRejectedValueOnce(new Error("network timeout")).mockResolvedValueOnce({ ok: true, targetId: "ts-1", newState: "REVIEWED_UNASSIGNED", newVersion: 2, auditEventId: "event-1", idempotencyReplay: true });
    render(<TimesheetIdentityReviewForm timesheet={{ id: "ts-1", identityVersion: 1, primaryEmployeeIdentityStatus: "NEEDS_REVIEW", primaryEmployeeId: null }} employees={[]} />);
    fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "REVIEW_UNASSIGNED" } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: "No defensible owner evidence." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed change" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await screen.findByText(/request did not complete/);
    const retry = await screen.findByRole("button", { name: "Confirm and save" });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.reviewTimesheet).toHaveBeenCalledTimes(2));
    const tokens = mocks.reviewTimesheet.mock.calls.map((call) => JSON.parse((call[1] as FormData).get("payload") as string).requestToken);
    expect(tokens).toEqual(["123e4567-e89b-42d3-a456-426614174000", "123e4567-e89b-42d3-a456-426614174000"]);
  });

  it("renders owner and automatic events distinctly in chronological sequence", () => {
    render(<RateReviewTimeline events={[{ id: "a", sequence: 1, decisionKind: "VERIFIED_INDEPENDENT", attributionKind: "OWNER_REVIEWER", previousStatus: "NEEDS_REVIEW", newStatus: "VERIFIED", previousProvenanceKind: "UNKNOWN", newProvenanceKind: "INDEPENDENT", previousSourcePaycheckId: null, newSourcePaycheckId: null, reviewerDisplayNameSnapshot: "Owner Snapshot", reviewerEmployeeCodeSnapshot: "O1", initiatedByDisplayNameSnapshot: null, previousVersion: 1, newVersion: 2, reason: "Verified.", sourceEvidenceReference: "Notice", createdAt: new Date("2026-10-15T12:00:00Z") }, { id: "b", sequence: 2, decisionKind: "PAYCHECK_CORRECTION_SUPERSEDED", attributionKind: "PAYCHECK_CORRECTION_SYSTEM", previousStatus: "VERIFIED", newStatus: "SUPERSEDED", previousProvenanceKind: "PAYCHECK", newProvenanceKind: "PAYCHECK", previousSourcePaycheckId: "p1", newSourcePaycheckId: "p1", reviewerDisplayNameSnapshot: null, reviewerEmployeeCodeSnapshot: null, initiatedByDisplayNameSnapshot: "Initiator Snapshot", previousVersion: 2, newVersion: 3, reason: "Paycheck corrected.", sourceEvidenceReference: "Correction p1", createdAt: new Date("2026-10-16T12:00:00Z") }]} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Owner review decision")).toBeInTheDocument();
    expect(within(items[1]).getByText("Automatic Paycheck correction")).toBeInTheDocument();
    expect(screen.getByText(/Owner Snapshot/)).toBeInTheDocument();
    expect(screen.getByText(/Initiated by Initiator Snapshot/)).toBeInTheDocument();
  });

  it("renders Timesheet reviewer snapshots and version progression", () => {
    render(<TimesheetReviewTimeline events={[{ id: "t1", sequence: 1, decisionKind: "OWNER_VERIFIED", previousStatus: "NEEDS_REVIEW", newStatus: "OWNER_VERIFIED", previousPrimaryEmployeeId: null, newPrimaryEmployeeId: "employee-1", previousEmployeeDisplayNameSnapshot: null, newEmployeeDisplayNameSnapshot: "Alex Snapshot", reviewerDisplayNameSnapshot: "Reviewer Snapshot", reviewerEmployeeCodeSnapshot: "R1", previousVersion: 1, newVersion: 2, reason: "Verified from schedule.", sourceEvidenceReference: "Schedule 42", createdAt: new Date("2026-10-15T12:00:00Z") }]} />);
    expect(screen.getByText(/Reviewer Snapshot \(R1\) · Version 1 → 2/)).toBeInTheDocument();
    expect(screen.getByText("Evidence: Schedule 42")).toBeInTheDocument();
  });
});
