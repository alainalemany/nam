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
    latestVerifiedRate: { id: "rate-1", effectiveFrom: "2026-01-01", hourlyRate: "30.0000" },
    currentRateTrust: { status: "UNCERTAIN", uncertaintyStart: "2026-09-01", reasons: ["OPEN_CANDIDATE"] },
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

function candidateDecisionRegion() {
  return screen.getByRole("region", { name: "Candidate decision" });
}

function exactEffectiveDateInput() {
  return within(candidateDecisionRegion()).getByLabelText("Exact effective date");
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
    expect(screen.getByText(/Latest verified rate · effective Jan 1, 2026 · current rate uncertain/)).toBeInTheDocument();
    expect(screen.getByText("Latest verified rate — current rate uncertain.")).toBeInTheDocument();
    expect(screen.getByText(/Expected gross is protected/)).toBeInTheDocument();
  });

  it("presents the latest verified boundary as current only without applicable unresolved evidence", () => {
    render(<RateHistoryOverview data={overview({
      currentRateTrust: { status: "TRUSTED", uncertaintyStart: null, reasons: [] },
      candidates: [],
      candidateCount: 0,
      counts: { all: 0, open: 0, resolved: 0, rejected: 0, superseded: 0 },
    })} />);
    expect(screen.getByText(/Current verified rate · effective Jan 1, 2026/)).toBeInTheDocument();
    expect(screen.queryByText("Latest verified rate — current rate uncertain.")).not.toBeInTheDocument();
  });

  it("distinguishes a resolved candidate's historical classification from its verified boundary", () => {
    render(<RateHistoryOverview data={overview({
      latestVerifiedRate: { id: "rate-2", effectiveFrom: "2026-09-07", hourlyRate: "32.5000" },
      rates: [{
        id: "rate-2", effectiveFrom: "2026-09-07", hourlyRate: "32.5000", verificationStatus: "VERIFIED", provenanceKind: "PAYCHECK", sourceNote: null, sourcePaycheckId: "paycheck-2", evidenceVersion: 1, supportCount: 2, supportingPeriods: ["2026-09-01–2026-09-14"], sourcePeriod: "2026-09-01–2026-09-14",
      }],
      candidates: [{ ...overview().candidates[0], status: "RESOLVED", evidenceVersion: 5, resolvedRateId: "rate-2" }],
      counts: { all: 2, open: 1, resolved: 1, rejected: 0, superseded: 0 },
    })} />);

    const candidates = screen.getByRole("region", { name: "Rate-change candidates" });
    const candidateRow = within(candidates).getAllByRole("row")[1];
    expect(within(candidateRow).getByText("Proposed increase")).toBeInTheDocument();
    expect(within(candidateRow).getByText("Verified boundary")).toBeInTheDocument();
    expect(within(candidateRow).getByText("$32.5000/hr")).toBeInTheDocument();
    expect(within(candidateRow).getByRole("link", { name: "Details →" })).toHaveAttribute("href", "/payroll/rate-history/candidates/candidate-1");

    const history = screen.getByRole("region", { name: "Verified Rate History" });
    const rateRow = within(history).getAllByRole("row")[1];
    expect(within(rateRow).getByText("Sep 7, 2026")).toBeInTheDocument();
    expect(within(rateRow).getByText("$32.5000/hr")).toBeInTheDocument();
    expect(within(rateRow).getByText("Verified", { exact: true })).toBeInTheDocument();
    expect(within(rateRow).getByText("Confirmed Paycheck")).toBeInTheDocument();
    expect(within(rateRow).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Latest verified rate — current rate uncertain.")).toBeInTheDocument();
  });

  it.each([
    ["CONFLICT", "conflicting rate evidence"],
    ["NEEDS_REVIEW", "newer review-required rate evidence"],
  ] as const)("explains %s evidence without promoting it", (reason, explanation) => {
    render(<RateHistoryOverview data={overview({
      currentRateTrust: { status: "UNCERTAIN", uncertaintyStart: "2026-08-15", reasons: [reason] },
    })} />);
    expect(screen.getByText(new RegExp(explanation))).toBeInTheDocument();
    expect(screen.getByText(/Expected-gross availability remains date-specific and server-controlled/)).toBeInTheDocument();
  });

  it("does not infer a current rate when no verified timeline exists", () => {
    render(<RateHistoryOverview data={overview({ latestVerifiedRate: undefined, currentRateTrust: { status: "NOT_ESTABLISHED", uncertaintyStart: null, reasons: [] }, rates: [], candidates: [], candidateCount: 0, counts: { all: 0, open: 0, resolved: 0, rejected: 0, superseded: 0 } })} />);
    expect(screen.getByText("Not established")).toBeInTheDocument();
    expect(screen.getByText("Current rate not established · no verified boundary")).toBeInTheDocument();
    expect(screen.getByText("No trusted rate history")).toBeInTheDocument();
    expect(screen.getByText("No candidates match this filter")).toBeInTheDocument();
  });

  it.each([
    ["FIRST_RATE_CANDIDATE", "First observed rate"],
    ["CANDIDATE_DECREASE", "Proposed decrease"],
    ["SAME_DATE_CONFLICT", "Conflicting evidence"],
    ["REPEATED_SUPPORTING_OBSERVATION", "Repeated supporting observation"],
  ])("presents %s with explicit text", (classification, label) => {
    const data = overview();
    data.candidates[0] = { ...data.candidates[0], classifications: [classification], primaryClassification: classification };
    render(<RateHistoryOverview data={data} />);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("shows a candidate's decrease direction even when conflict is the primary classification", () => {
    const data = overview();
    data.candidates[0] = {
      ...data.candidates[0],
      classifications: ["SAME_DATE_CONFLICT", "CANDIDATE_DECREASE", "UNCERTAIN_EFFECTIVE_DATE_CHANGE"],
      primaryClassification: "SAME_DATE_CONFLICT",
    };
    render(<RateHistoryOverview data={data} />);
    const candidateRow = screen.getAllByRole("row")[1];
    expect(within(candidateRow).getByText("Conflicting evidence")).toBeInTheDocument();
    expect(within(candidateRow).getByText("Proposed decrease")).toBeInTheDocument();
    expect(within(candidateRow).getByText("Uncertain effective date")).toBeInTheDocument();
  });

  it.each([
    ["REJECTED", "Rejected candidate"],
    ["SUPERSEDED", "Superseded candidate"],
  ] as const)("distinguishes %s candidates from open uncertainty", (status, label) => {
    const data = overview();
    data.candidates[0] = { ...data.candidates[0], status };
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
  it("uniquely identifies the promotion form and never preselects an exact date", () => {
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    const decision = candidateDecisionRegion();
    expect(decision).toBeInTheDocument();
    expect(within(decision).getByRole("radiogroup", { name: "Candidate decision" })).toBeInTheDocument();
    fireEvent.click(within(decision).getByLabelText("Confirm exact effective date"));
    const exactDate = exactEffectiveDateInput();
    expect(exactDate).toHaveAttribute("type", "date");
    expect(exactDate).toHaveValue("");
    exactDate.focus();
    fireEvent.change(exactDate, { target: { value: "2026-09-30" } });
    expect(within(decision).getByRole("alert")).toHaveTextContent(/inside the evidence window/);
    expect(exactDate).toHaveFocus();
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
    const exactDate = exactEffectiveDateInput();
    fireEvent.change(exactDate, { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Exact date confirmed from authenticated row evidence." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    const confirmation = screen.getByRole("group", { name: "Confirm rate boundary decision" });
    await waitFor(() => expect(confirmation).toHaveFocus());
    expect(within(confirmation).getByText("Confirm verified boundary")).toBeInTheDocument();
    expect(within(confirmation).getByText("2026-09-07")).toBeInTheDocument();
    expect(exactDate).toHaveValue("2026-09-07");
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
    expect(within(candidateDecisionRegion()).queryByLabelText("Exact effective date")).not.toBeInTheDocument();
    expect(screen.getByText("Reject the boundary, not the evidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review proposed decision" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Source evidence disproves this proposed boundary." } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    expect(within(candidateDecisionRegion()).queryByLabelText("Exact effective date")).not.toBeInTheDocument();
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

  it("retries an unchanged promotion with the same decision identity and presents the replay result", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({
      ok: true,
      targetId: "candidate-1",
      newState: "RESOLVED",
      newVersion: 5,
      auditEventId: "event-1",
      idempotencyReplay: true,
    });
    const { rerender } = render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Confirm exact effective date"));
    fireEvent.change(exactEffectiveDateInput(), { target: { value: "2026-09-07" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Authenticated evidence confirms this exact date." } });
    fireEvent.change(screen.getByLabelText(/Evidence reference/), { target: { value: "WAGE-NOTICE-7" } });
    fireEvent.click(screen.getByRole("button", { name: "Review proposed decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm exact boundary" }));
    await screen.findByText(/outcome is uncertain/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm exact boundary" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirm exact boundary" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledTimes(2));
    const payloads = mocks.verify.mock.calls.map((call) => (call[1] as FormData).get("payload"));
    expect(payloads).toEqual([payloads[0], payloads[0]]);
    expect(await screen.findByText(/This exact decision was already saved/)).toBeInTheDocument();
    expect(screen.getByText(/Authoritative candidate state: RESOLVED; version 5; event event-1/)).toBeInTheDocument();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "View refreshed candidate details" })).toHaveAttribute(
      "href",
      "/payroll/rate-history/candidates/candidate-1",
    );
    rerender(<RateBoundaryDecisionForm candidate={{ ...candidate, status: "RESOLVED", evidenceVersion: 5 }} />);
    expect(screen.getByText(/This exact decision was already saved/)).toBeInTheDocument();
    expect(screen.getByText(/Authoritative candidate state: RESOLVED; version 5; event event-1/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Candidate decision" })).not.toBeInTheDocument();
  });

  it("renders a server-loaded resolved candidate as complete without review controls", () => {
    render(<RateBoundaryDecisionForm candidate={{ ...candidate, status: "RESOLVED", evidenceVersion: 5 }} />);
    expect(screen.getByRole("heading", { name: "Decision complete" })).toBeInTheDocument();
    expect(screen.getByText(/candidate is resolved and cannot accept another transition/)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Candidate decision" })).not.toBeInTheDocument();
  });

  it("surfaces stale-version feedback without mutating the decision locally", async () => {
    mocks.verify.mockResolvedValue({ ok: false, code: "STALE_REVIEW", message: "stale" });
    render(<RateBoundaryDecisionForm candidate={candidate} />);
    fireEvent.click(screen.getByLabelText("Confirm exact effective date"));
    fireEvent.change(exactEffectiveDateInput(), { target: { value: "2026-09-07" } });
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
