import Link from "next/link";

import { getMaintenanceTrackers } from "@/features/maintenance-tracking/data";
import { formatMaintenanceValue, maintenanceProgressPercentage, maintenanceRuntimeCoverageLabel, maintenanceStatusLabel } from "@/features/maintenance-tracking/domain";

export const dynamic = "force-dynamic";
type Props = { searchParams?: Promise<{ equipmentId?: string }> };

export default async function MaintenancePage({ searchParams }: Props) {
  const [trackers, query] = await Promise.all([getMaintenanceTrackers(), searchParams]);
  const visible = query?.equipmentId ? trackers.filter((tracker) => tracker.equipmentId === query.equipmentId) : trackers;
  const grouped = visible.reduce((result, tracker) => {
    const existing = result.get(tracker.equipmentLabel) ?? [];
    existing.push(tracker);
    result.set(tracker.equipmentLabel, existing);
    return result;
  }, new Map<string, typeof visible>());

  return <main className="page-stack">
    <section className="page-header with-actions"><div><p className="eyebrow">Equipment operations</p><h1>Maintenance Tracking</h1><p className="summary">DDR-derived operating hours, component service intervals, lifecycles, and retained PM history by Dragline.</p></div><Link className="button primary" href="/maintenance/new">Track Component</Link></section>
    {query?.equipmentId ? <div className="filter-summary"><span>Showing one selected Dragline.</span><Link className="table-action" href="/maintenance">Show all Equipment</Link></div> : null}
    {visible.length === 0 ? <section className="panel"><div className="empty-state"><h2>No maintenance trackers found</h2><p>Create a tracker for Dragline Equipment and a configured component. Completed DDRs will supply its hours.</p><Link className="button primary" href="/maintenance/new">Create Tracker</Link></div></section> : [...grouped.entries()].map(([equipmentLabel, items]) => <section className="panel table-panel" key={equipmentLabel}>
      <div className="section-heading"><div><p className="eyebrow">Dragline</p><h2>{equipmentLabel}</h2></div><span className="count-pill">{items.length}</span></div>
      <div className="maintenance-card-grid">{items.map((tracker) => {
        const next = tracker.nextRule;
        const progress = next ? maintenanceProgressPercentage(next.currentValue, next.dueValue) : 0;
        return <article className="maintenance-card" key={tracker.trackerId}>
          <div className="section-heading"><div><h3>{tracker.componentName}</h3><span className="subtle">Lifecycle {tracker.lifecycleNumber}</span></div><span className={`maintenance-status maintenance-status--${tracker.status.toLowerCase().replace("_", "-")}`}>{maintenanceStatusLabel(tracker.status)}</span></div>
          <div><strong className="maintenance-value">{next ? `${formatMaintenanceValue(next.currentValue)} / ${formatMaintenanceValue(next.dueValue)}` : formatMaintenanceValue(tracker.lifecycleValue)} {tracker.trackingUnit.toLowerCase()}</strong><div className="maintenance-meter-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div></div>
          {next ? <dl className="meta-list"><dt>Next action</dt><dd>{next.rule.actionName}</dd><dt>{next.overdueValue > 0 ? "Overdue" : "Remaining"}</dt><dd>{next.overdueValue > 0 ? `+${formatMaintenanceValue(next.overdueValue)} h` : next.status === "DUE_WINDOW" ? "Inside service window" : `${formatMaintenanceValue(next.remainingValue)} h`}</dd>{next.rule.counterScope === "SERVICE_INTERVAL" ? <><dt>Total lifecycle</dt><dd>{formatMaintenanceValue(tracker.lifecycleValue)} h</dd></> : null}{next.rule.maximumRepeatCount ? <><dt>Services</dt><dd>{next.completedCount} / {next.rule.maximumRepeatCount}</dd></> : null}</dl> : <p className="subtle">No active rule remains in this lifecycle.</p>}
          <p className="subtle">{maintenanceRuntimeCoverageLabel(tracker.runtimeCoverage)}</p>
          <Link className="table-action" href={`/maintenance/${tracker.trackerId}`}>View status and history →</Link>
        </article>;
      })}</div>
    </section>)}
  </main>;
}
