import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), reject: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/payroll/evidence-review-actions", () => ({
  verifyExactPayRateBoundaryAction: mocks.verify,
  rejectPayRateBoundaryCandidateAction: mocks.reject,
}));

import { RateBoundaryDecisionForm, type BoundaryDecisionCandidate } from "@/features/payroll/RateBoundaryDecisionForm";
import { RateBoundaryTimeline } from "@/features/payroll/RateBoundaryTimeline";
import { RateHistoryOverview } from "@/features/payroll/RateHistoryOverview";
import type { RateHistoryOverviewData } from "@/features/payroll/rate-history-data";

const token = "123e4567-e89b-42d3-a456-426614174000";
const candidate: BoundaryDecisionCandidate = {
  id: "candidate-1",
  status: "OPEN",
  evidenceVersion: 4,
  observedHourlyRate: "32.5000",
  earliestEffectiveDate: "2026-09-01",
  latestEffectiveDate: "2026-09-14",
  previousRate: { hourlyRate: "30.0000", effectiveFrom: "2026-01-01" },
  affectedEntryCount: 3,
  conflictCount: 1,
  promotableObservationCount: 1,
};

function overview(overrides: Partial<RateHistoryOverviewData> = {}): RateHistoryOverviewData {
  return {
    employee: { id: "employee-1", displayName: "Alex Employee", employeeCode: "A1", isActive: true },
    currentVerifiedRate: {
      id: "rate-1", effectiveFrom: "2026-01-01", hourlyRate: "30.0000", verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourceNote: null, sourcePaycheckId: "paycheck-1", evidenceVersion: 1, supportCount: 2, supportingPeriods: ["2026-01-01–2026-01-14"], sourcePeriod: "2026-01-01–2026-01-14",
    },
    rates: [{
      id: "rate-1", effectiveFrom: "2026-01-01", hourlyRate: "30.0000", verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourceNote: null, sourcePaycheckId: "paycheck-1", evidenceVersion: 1, supportCount: 2, supportingPeriods: ["2026-01-01–2026-01-14"], sourcePeriod: "2026-01-01–2026-01-14",
    }],
    candidates: [{ id: "candidate-1", observedHourlyRate: "32.5000", earliestEffectiveDate: "2026-09-01", latestEffectiveDate: "2026-09-14", status: "OPEN", evidenceVersion: 4, observationCount: 2, activeObservationCount: 2, supportedObservationCount: 1, sourcePaycheckCount: 2, classifications: ["CANDIDATE_INCREASE", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"], primaryClassification: "CANDIDATE_INCREASE", resolvedRateId: null }],
    page: 1,
    pageSize: 20,
    candidateCount: 1,
    status: "all",
    counts: { all: 1, open: 1, resolved: 0, rejected: 0, superseded: 0 },
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => token) });
  mocks.verify.mockResolvedValue({ ok: true, targetId: "candidate-1", newState: "RESOLVED", newVersion: 5, auditEventId: "event-1", idempotencyReplay: false });
  mocks.reject.mockResolvedValue({ ok: true, targetId: "candidate-1", newState: "REJECTED", newVersion: 5, auditEventId: "event-2", idempotencyReplay: false });
});
describe("progressive rate-history overview", () => {
  it("renders only a verified current rate with support counts and explicit open uncertainty", () => {
    render(<RateHistoryOverview data={overview()} />);
    expect(screen.getAllByText("$30.0000/hr").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 active rows/)).toBeInTheDocument();
    expect(screen.getAllByText(/1 promotable/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Proposed increase").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Uncertain effective date").length).toBeGreaterThan(0);
    expect(screen.getByText(/Expected gross is protected/)).toBeInTheDocument();
  });

  it("does not infer a current rate when no verified timeline exists", () => {
    render(<RateHistoryOverview data={overview({ currentVerifiedRate: undefined, rates: [], candidates: [], candidateCount: 0, counts: { all: 0, open: 0, resolved: 0, rejected: 0, superseded: 0 } })} />);
    expect(screen.getByText("Not established")).toBeInTheDocument();
    expect(screen.getByText("No trusted rate history")).toBeInTheDocument();
    expect(screen.getByText("No candidates match this filter")).toBeInTheDocument();
  });

  it.each([
    ["CANDIDATE_DECREASE", "Proposed decrease"],
    ["SAME_DATE_CONFLICT", "Conflicting evidence"],
    ["REPEATED_SUPPORTING_OBSERVATION", "Repeated supporting observation"],
  ])("presents %s with explicit text", (classification, label) => {
    const data = overview();
    data.candidates[0] = { ...data.candidates[0], classifications: [classification], primaryClassification: classification };
    render(<RateHistoryOverview data={data} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("provides a mobile candidate representation without relying on the dense table", () => {
    const { container } = render(<RateHistoryOverview data={overview()} />);
    expect(container.querySelector(".rate-history-table-shell")).toBeInTheDocument();
    expect(container.querySelector(".rate-candidate-list")).toBeInTheDocument();
    expect(container.querySelector(".rate-timeline-list")).toBeInTheDocument();
    expect(within(container.querySelector(".rate-candidate-list")!).getByRole("link", { name: "Review candidate" })).toHaveAttribute("href", "/payroll/rate-history/candidates/candidate-1");
  });
});

describe("rate-boundary candidate decisions", () => {
  it("requires an explicit real in-window date and never preselects one", () => {
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Confirm exact effective date"));
    expect(screen.getByLabelText(/^Exact effective date/)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/^Exact effective date/), { target: { value: "2026-09-30" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/inside the evidence window/);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Confirmed from retained evidence." } });
    expect(screen.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();
  });

  it("disables promotion when no active authenticated support is eligible", () => {
    render(<RateBoundaryDecisionForm candidate={{ ...candidate, promotableObservationCount: 0 }} />);
    expect(screen.getByText("Promotion unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm exact effective date")).toBeDisabled();
    expect(screen.getByLabelText("Reject proposed boundary")).toBeEnabled();
  });

  it("shows previous/proposed rates and impact before submitting versioned promotion", async () => {
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Confirm exact effective date"));
    fireEvent.change(screen.getByLabelText(/^Exact effective date/), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Exact date confirmed from authenticated row evidence." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    expect(screen.getByText("Confirm verified boundary")).toBeInTheDocument();
    expect(screen.getByText("$30.0000/hr")).toBeInTheDocument();
    expect(screen.getByText("$32.5000/hr")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm exact boundary" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledOnce());
    const payload = JSON.parse((mocks.verify.mock.calls[0][1] as FormData).get("payload") as string);
    expect(payload).toMatchObject({ candidateId: "candidate-1", expectedEvidenceVersion: 4, exactEffectiveDate: "2026-09-07", requestToken: token });
    expect(await screen.findByText("Decision complete")).toBeInTheDocument();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("requires confirmation and a reason to reject while explaining evidence retention", async () => {
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Reject proposed boundary"));
    expect(screen.getByText("Reject the boundary, not the evidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Source evidence disproves this proposed boundary." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    expect(mocks.reject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledOnce());
    const payload = JSON.parse((mocks.reject.mock.calls[0][1] as FormData).get("payload") as string);
    expect(payload).toMatchObject({ candidateId: "candidate-1", expectedEvidenceVersion: 4, requestToken: token });
    expect(await screen.findByText(/No observations were deleted/)).toBeInTheDocument();
  });

  it("preserves the same token for a safe retry after an ambiguous network failure", async () => {
    mocks.reject.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true, targetId: "candidate-1", newState: "REJECTED", newVersion: 5, auditEventId: "event-2", idempotencyReplay: true });
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Reject proposed boundary"));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Unsupported proposed boundary." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    await screen.findByText(/outcome is uncertain/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm rejection" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledTimes(2));
    expect(mocks.reject.mock.calls.map((call) => JSON.parse((call[1] as FormData).get("payload") as string).requestToken)).toEqual([token, token]);
  });

  it("surfaces stale-version feedback without mutating the decision locally", async () => {
    mocks.verify.mockResolvedValue({ ok: false, code: "STALE_REVIEW", message: "stale" });
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Confirm exact effective date"));
    fireEvent.change(screen.getByLabelText(/^Exact effective date/), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Evidence reviewed." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm exact boundary" }));
    expect(await screen.findByText(/candidate changed/)).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("candidate immutable timeline", () => {
  it("distinguishes system classification from owner approval and uses recorded reviewer snapshots", () => {
    render(<RateBoundaryTimeline createdAt="2026-09-15T12:00:00.000Z" classification="Proposed increase" events={[{ id: "event-1", decisionKind: "REJECTED", previousStatus: "OPEN", newStatus: "REJECTED", previousVersion: 4, newVersion: 5, exactEffectiveDate: null, employeePayRateId: null, reviewerDisplayNameSnapshot: "Recorded Reviewer", reviewerEmployeeCodeSnapshot: "R1", reason: "Evidence disproved the candidate.", sourceEvidenceReference: "Notice 17", createdAt: "2026-09-16T12:00:00.000Z" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("System classification")).toBeInTheDocument();
    expect(within(items[1]).getByText("Owner review decision")).toBeInTheDocument();
    expect(screen.getByText(/Recorded Reviewer \(R1\) · Version 4 → 5/)).toBeInTheDocument();
  });
});
