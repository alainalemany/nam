import { AlertTriangle, BadgeCheck, Banknote, FileClock } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatRate, formatReviewDate, provenanceLabels, rateStatusLabels } from "./evidence-review-presentation";
import type { RateHistoryOverviewData } from "./rate-history-data";
import { candidateStatusLabels, classificationLabels } from "./rate-history-presentation";

function Status({ value, tone }: { value: string; tone: string }) {
  return <span className={`rate-status rate-status--${tone}`}>{value}</span>;
}
function filterHref(status: string) {
  return `/payroll/rate-history${status === "all" ? "" : `?status=${status}`}`;
}
function SecondaryClassifications({ classifications, primary }: { classifications: string[]; primary: string }) {
  return classifications
    .filter((classification) => classification !== primary)
    .map((classification) => <span className="rate-cell-note" key={classification}>{classificationLabels[classification]}</span>);
}

export function RateHistoryOverview({ data }: { data: RateHistoryOverviewData }) {
  const latestVerified = data.latestVerifiedRate;
  const currentIsUncertain = data.currentRateTrust.status === "UNCERTAIN";
  const uncertaintyReasons = data.currentRateTrust.reasons.map((reason) => reason === "OPEN_CANDIDATE"
    ? "an open rate-change candidate"
    : reason === "CONFLICT" ? "conflicting rate evidence" : "newer review-required rate evidence");
  return <>
    <section className="payroll-summary-grid rate-summary-grid" aria-label="Rate history summary">
      <Card className="payroll-metric"><CardContent><span className="payroll-metric-icon rate-icon--verified"><Banknote aria-hidden="true" /></span><strong className="payroll-metric-value">{latestVerified ? formatRate(latestVerified.hourlyRate) : "Not established"}</strong><span className="payroll-metric-label">{latestVerified ? currentIsUncertain ? `Latest verified rate · effective ${formatReviewDate(latestVerified.effectiveFrom)} · current rate uncertain` : `Current verified rate · effective ${formatReviewDate(latestVerified.effectiveFrom)}` : "Current rate not established · no verified boundary"}</span></CardContent></Card>
      <Card className="payroll-metric"><CardContent><span className="payroll-metric-icon rate-icon--verified"><BadgeCheck aria-hidden="true" /></span><strong className="payroll-metric-value">{data.rates.length}</strong><span className="payroll-metric-label">Verified exact boundaries shown</span></CardContent></Card>
      <Card className="payroll-metric"><CardContent><span className="payroll-metric-icon rate-icon--warning"><FileClock aria-hidden="true" /></span><strong className="payroll-metric-value">{data.counts.open}</strong><span className="payroll-metric-label">Open change candidates</span></CardContent></Card>
      <Card className="payroll-metric"><CardContent><span className="payroll-metric-icon rate-icon--danger"><AlertTriangle aria-hidden="true" /></span><strong className="payroll-metric-value">{data.candidates.filter((item) => item.classifications.includes("SAME_DATE_CONFLICT")).length}</strong><span className="payroll-metric-label">Conflicts on this page</span></CardContent></Card>
    </section>

    {currentIsUncertain ? <div className="payroll-notice payroll-notice--warning" role="status"><strong>Latest verified rate — current rate uncertain.</strong><p>Unresolved evidence from {data.currentRateTrust.uncertaintyStart ? formatReviewDate(data.currentRateTrust.uncertaintyStart) : "an unknown date"} may supersede the historical boundary: {uncertaintyReasons.join(", ")}. Expected-gross availability remains date-specific and server-controlled.</p></div> : null}

    {data.counts.open > 0 ? <div className="payroll-notice payroll-notice--warning" role="status"><strong>Expected gross is protected by unresolved rate evidence.</strong><p>Work dates on or after an open candidate&apos;s earliest possible boundary remain unavailable until the backend confirms that no unresolved uncertainty applies.</p></div> : null}

    <Card>
      <CardHeader><div><CardTitle>Rate-change candidates</CardTitle><p className="subtle">Tentative observations stay separate from authoritative EmployeePayRate boundaries.</p></div></CardHeader>
      <CardContent>
        <nav className="rate-filter-tabs" aria-label="Candidate status filters">
          {(["all", "open", "resolved", "rejected", "superseded"] as const).map((status) => <Link key={status} aria-current={data.status === status ? "page" : undefined} href={filterHref(status)}>{status === "all" ? "All" : candidateStatusLabels[status.toUpperCase()]} <span>{data.counts[status]}</span></Link>)}
        </nav>
      </CardContent>
      {data.candidates.length ? <>
        <div className="payroll-table-scroll rate-history-table-shell"><table className="payroll-history-table rate-history-table"><thead><tr><th>Classification</th><th>Observed rate</th><th>Evidence window</th><th>Support</th><th>Status</th><th /></tr></thead><tbody>{data.candidates.map((candidate) => <tr key={candidate.id}><td><strong>{classificationLabels[candidate.primaryClassification]}</strong><SecondaryClassifications classifications={candidate.classifications} primary={candidate.primaryClassification} /></td><td>{formatRate(candidate.observedHourlyRate)}</td><td>{formatReviewDate(candidate.earliestEffectiveDate)}–{candidate.latestEffectiveDate ? formatReviewDate(candidate.latestEffectiveDate) : "open ended"}</td><td>{candidate.activeObservationCount} active row{candidate.activeObservationCount === 1 ? "" : "s"}<span className="rate-cell-note">{candidate.supportedObservationCount} promotable · {candidate.sourcePaycheckCount} Paycheck{candidate.sourcePaycheckCount === 1 ? "" : "s"}</span></td><td><Status value={candidateStatusLabels[candidate.status]} tone={candidate.status.toLowerCase()} /></td><td><Link className="table-action" href={`/payroll/rate-history/candidates/${candidate.id}`}>{candidate.status === "OPEN" ? "Review →" : "Details →"}</Link></td></tr>)}</tbody></table></div>
        <div className="rate-candidate-list" aria-label="Rate-change candidates">{data.candidates.map((candidate) => <article key={candidate.id}><div className="rate-candidate-heading"><div><span>{classificationLabels[candidate.primaryClassification]}</span><SecondaryClassifications classifications={candidate.classifications} primary={candidate.primaryClassification} /><strong>{formatRate(candidate.observedHourlyRate)}</strong></div><Status value={candidateStatusLabels[candidate.status]} tone={candidate.status.toLowerCase()} /></div><dl><div><dt>Evidence window</dt><dd>{formatReviewDate(candidate.earliestEffectiveDate)}–{candidate.latestEffectiveDate ? formatReviewDate(candidate.latestEffectiveDate) : "open ended"}</dd></div><div><dt>Evidence</dt><dd>{candidate.activeObservationCount} active · {candidate.supportedObservationCount} promotable</dd></div></dl><Link className="button secondary" href={`/payroll/rate-history/candidates/${candidate.id}`}>{candidate.status === "OPEN" ? "Review candidate" : "View details"}</Link></article>)}</div>
      </> : <div className="payroll-empty"><BadgeCheck aria-hidden="true" /><strong>No candidates match this filter</strong><span>Repeated evidence that supports an established rate does not require an owner decision.</span></div>}
      {data.candidateCount > data.pageSize ? <CardContent><nav className="review-pagination" aria-label="Candidate pages">{data.page > 1 ? <Link className="button secondary" href={`${filterHref(data.status)}${data.status === "all" ? "?" : "&"}page=${data.page - 1}`}>Previous page</Link> : <span />}{data.page * data.pageSize < data.candidateCount ? <Link className="button secondary" href={`${filterHref(data.status)}${data.status === "all" ? "?" : "&"}page=${data.page + 1}`}>Next page</Link> : null}</nav></CardContent> : null}
    </Card>

    <Card>
      <CardHeader><div><CardTitle>Verified Rate History</CardTitle><p className="subtle">Only authoritative VERIFIED exact boundaries are shown. Quarantined, conflicting, superseded, and excluded evidence remains outside this timeline.</p></div></CardHeader>
      {data.rates.length ? <><div className="payroll-table-scroll rate-history-table-shell"><table className="payroll-history-table rate-history-table"><thead><tr><th>Effective date</th><th>Hourly rate</th><th>Status</th><th>Provenance</th><th>Supporting observations</th><th>Supporting periods</th></tr></thead><tbody>{data.rates.map((rate) => <tr key={rate.id}><td>{formatReviewDate(rate.effectiveFrom)}</td><td><strong>{formatRate(rate.hourlyRate)}</strong></td><td><Status value={rateStatusLabels[rate.verificationStatus]} tone={rate.verificationStatus.toLowerCase()} /></td><td>{provenanceLabels[rate.provenanceKind]}</td><td>{rate.supportCount}</td><td>{rate.supportingPeriods.length ? rate.supportingPeriods.join(", ") : rate.sourcePeriod ?? "No linked Paycheck period"}</td></tr>)}</tbody></table></div><div className="rate-timeline-list" aria-label="Authoritative rate timeline">{data.rates.map((rate) => <article key={rate.id}><div className="rate-candidate-heading"><div><span>Effective {formatReviewDate(rate.effectiveFrom)}</span><strong>{formatRate(rate.hourlyRate)}</strong></div><Status value={rateStatusLabels[rate.verificationStatus]} tone={rate.verificationStatus.toLowerCase()} /></div><dl><div><dt>Provenance</dt><dd>{provenanceLabels[rate.provenanceKind]}</dd></div><div><dt>Supporting observations</dt><dd>{rate.supportCount}</dd></div><div><dt>Supporting periods</dt><dd>{rate.supportingPeriods.length ? rate.supportingPeriods.join(", ") : rate.sourcePeriod ?? "No linked Paycheck period"}</dd></div></dl></article>)}</div></> : <div className="payroll-empty"><Banknote aria-hidden="true" /><strong>No trusted rate history</strong><span>A current rate will appear only after an exact boundary has authoritative verified evidence.</span></div>}
    </Card>
  </>;
}
