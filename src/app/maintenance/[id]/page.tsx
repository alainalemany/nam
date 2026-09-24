import Link from "next/link";
import { notFound } from "next/navigation";

import { displayMaintenanceDateTime, getMaintenanceTracker } from "@/features/maintenance-tracking/data";
import { formatMaintenanceValue, maintenanceStatusLabel } from "@/features/maintenance-tracking/domain";
import { MaintenanceTrackerActions } from "@/features/maintenance-tracking/MaintenanceTrackerActions";
import { localDateTimeInputParts } from "@/lib/zoned-date-time";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string }> };
export const dynamic = "force-dynamic";

function serviceVariance(event: {
  varianceValueSnapshot: { toString(): string };
  upperThresholdSnapshot: { toString(): string } | null;
  intervalValueAtService: { toString(): string };
}) {
  const variance = Number(event.varianceValueSnapshot);
  const actual = Number(event.intervalValueAtService);
  const upper = event.upperThresholdSnapshot == null ? undefined : Number(event.upperThresholdSnapshot);
  if (upper != null && actual <= upper && variance >= 0) return "Within service window";
  if (variance === 0) return "On target";
  return variance < 0 ? `${formatMaintenanceValue(Math.abs(variance))} h early` : `${formatMaintenanceValue(variance)} h overdue`;
}

export default async function MaintenanceTrackerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [result, query] = await Promise.all([getMaintenanceTracker(id), searchParams]);
  if (!result) notFound();
  const { tracker, summary } = result;
  const defaults = localDateTimeInputParts();
  const lastService = tracker.serviceEvents.at(-1);
  const availableRules = summary.rules.map((rule) => ({
    id: rule.rule.id,
    actionName: rule.rule.actionName,
    context: `${formatMaintenanceValue(rule.currentValue)} / ${formatMaintenanceValue(rule.dueValue)} h`,
  }));

  return <main className="page-stack">
    <section className="page-header with-actions"><div><p className="eyebrow">{summary.equipmentLabel}</p><h1>{summary.componentName}</h1><p className="summary">Lifecycle {summary.lifecycleNumber} · DDR-derived operating hours · {tracker.component.trackingUnit}</p></div><Link className="button secondary" href="/maintenance">Back to Maintenance</Link></section>
    {query?.saved ? <div className="success-confirmation" role="status"><strong>{query.saved === "service" ? "Service action recorded at its operational effective time." : "Exceptional manual adjustment recorded."}</strong></div> : null}

    <section className="maintenance-detail-grid">
      {summary.rules.map((rule) => <article className="panel maintenance-detail-card" key={rule.rule.id}><div className="section-heading"><div><p className="eyebrow">{rule.rule.counterScope === "SERVICE_INTERVAL" ? "Current interval" : "Component lifecycle"}</p><h2>{rule.rule.actionName}</h2></div><span className={`maintenance-status maintenance-status--${rule.status.toLowerCase().replace("_", "-")}`}>{maintenanceStatusLabel(rule.status)}</span></div><strong className="maintenance-value maintenance-value--large">{formatMaintenanceValue(rule.currentValue)} / {formatMaintenanceValue(rule.dueValue)} h</strong>{rule.upperDueValue ? <span className="subtle">Service window ends at {formatMaintenanceValue(rule.upperDueValue)} h</span> : null}<dl className="meta-list"><dt>{rule.overdueValue > 0 ? "Overdue" : "Remaining"}</dt><dd>{rule.overdueValue > 0 ? `+${formatMaintenanceValue(rule.overdueValue)} h` : rule.status === "DUE_WINDOW" ? "Inside configured window" : `${formatMaintenanceValue(rule.remainingValue)} h`}</dd><dt>Counter since</dt><dd>{displayMaintenanceDateTime(rule.counterStartedAt)}</dd>{rule.rule.maximumRepeatCount ? <><dt>Services</dt><dd>{rule.completedCount} / {rule.rule.maximumRepeatCount}</dd></> : null}</dl></article>)}
      <article className="panel maintenance-detail-card"><div><p className="eyebrow">Lifecycle summary</p><h2>Total component life</h2></div><strong className="maintenance-value maintenance-value--large">{formatMaintenanceValue(summary.lifecycleValue)} h</strong><dl className="meta-list"><dt>Lifecycle</dt><dd>{summary.lifecycleNumber}</dd><dt>Started</dt><dd>{displayMaintenanceDateTime(summary.lifecycleStartedAt)}</dd><dt>Last service</dt><dd>{lastService ? `${lastService.actionNameSnapshot} · ${displayMaintenanceDateTime(lastService.effectiveAt)}` : "No service recorded"}</dd></dl></article>
    </section>

    <MaintenanceTrackerActions trackerId={tracker.id} recordVersion={tracker.recordVersion} trackingUnit={summary.trackingUnit} defaultDate={defaults.date} defaultTime={defaults.time} rules={availableRules} />

    <section className="panel table-panel"><div className="section-heading"><div><p className="eyebrow">Permanent operational record</p><h2>Service History</h2></div><span className="count-pill">{tracker.serviceEvents.length}</span></div>{tracker.serviceEvents.length === 0 ? <div className="empty-state"><h3>No service recorded</h3><p>Early, on-time, and overdue PM actions will remain here with effective and recorded timestamps.</p></div> : <div className="table-wrap"><table><thead><tr><th>Effective</th><th>Action</th><th>At service</th><th>Target snapshot</th><th>Lifecycle</th><th>Recorded</th></tr></thead><tbody>{[...tracker.serviceEvents].reverse().map((event) => <tr key={event.id}><td>{displayMaintenanceDateTime(event.effectiveAt)}</td><td><strong>{event.actionNameSnapshot}</strong><span className="subtle">#{event.serviceSequence}{event.startsNewLifecycleSnapshot ? " · replacement" : ""}</span></td><td><strong>{formatMaintenanceValue(Number(event.intervalValueAtService))} h</strong><span className="subtle">{serviceVariance(event)}</span></td><td>{formatMaintenanceValue(Number(event.targetValueSnapshot))}{event.upperThresholdSnapshot ? `–${formatMaintenanceValue(Number(event.upperThresholdSnapshot))}` : ""} h</td><td>{event.lifecycleNumber}<span className="subtle">{formatMaintenanceValue(Number(event.lifecycleValueAtService))} h total{event.startsNewLifecycleSnapshot ? " · closes lifecycle" : ""}</span></td><td>{displayMaintenanceDateTime(event.createdAt)}{event.recordedBy ? <span className="subtle">by {event.recordedBy}</span> : null}{event.notes ? <span className="subtle">{event.notes}</span> : null}</td></tr>)}</tbody></table></div>}</section>

    <section className="panel table-panel"><div className="section-heading"><div><p className="eyebrow">Administrative exceptions only</p><h2>Manual Adjustments</h2></div><span className="count-pill">{tracker.counterEntries.length}</span></div>{tracker.counterEntries.length === 0 ? <div className="empty-state"><h3>No manual adjustments</h3><p>Normal operating hours come from completed DDRs for this exact Dragline.</p></div> : <div className="table-wrap"><table><thead><tr><th>Effective</th><th>Added</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{[...tracker.counterEntries].reverse().map((entry) => <tr key={entry.id}><td>{displayMaintenanceDateTime(entry.effectiveAt)}</td><td>+{formatMaintenanceValue(Number(entry.adjustmentValue))} h</td><td>{entry.reason}</td><td>{displayMaintenanceDateTime(entry.createdAt)}{entry.recordedBy ? <span className="subtle">by {entry.recordedBy}</span> : null}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
