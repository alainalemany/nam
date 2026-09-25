import Link from "next/link";

import type { EvaluatedMaintenanceTracker } from "@/features/maintenance-tracking/domain";
import {
  formatMaintenanceValue,
  maintenanceProgressPercentage,
  maintenanceRuntimeCoverageLabel,
  maintenanceStatusLabel,
} from "@/features/maintenance-tracking/domain";
import { displayHomeShiftDate, type HomeShiftSummary } from "@/features/work-schedule/home-summary";

function statusClass(status: EvaluatedMaintenanceTracker["status"]) {
  return `maintenance-status maintenance-status--${status.toLowerCase().replace("_", "-")}`;
}

export function CurrentNextShiftCard({ shift }: { shift?: HomeShiftSummary }) {
  return <section className="dashboard-card dashboard-card--featured dashboard-card--shift" aria-labelledby="home-shift-heading">
    <div className="section-heading"><div><p className="eyebrow">Work Schedule</p><h2 id="home-shift-heading">{shift?.kind === "CURRENT" ? "Current Shift" : "Next Shift"}</h2></div>{shift ? <span className={`maintenance-status ${shift.kind === "CURRENT" ? "maintenance-status--due-window" : "maintenance-status--healthy"}`}>{shift.relativeLabel}</span> : null}</div>
    {!shift ? <div className="empty-state"><h3>No upcoming assignment</h3><p>No active or future Day/Night assignment is available in Work Schedule.</p></div> : <div className="dashboard-shift-body">
      <div><span className="subtle">{displayHomeShiftDate(shift.assignmentDate)}</span><strong className="dashboard-primary-value">{shift.shiftLabel}</strong><span>{shift.timeLabel}</span></div>
      <dl className="meta-list">{shift.equipmentLabel ? <><dt>Equipment</dt><dd>{shift.equipmentLabel}</dd></> : null}{shift.mineName ? <><dt>Mine</dt><dd>{shift.mineName}</dd></> : null}{shift.partnerLabel ? <><dt>Partner</dt><dd>{shift.partnerLabel}</dd></> : null}</dl>
    </div>}
    <Link className="table-action" href={shift ? `/work-schedule/${shift.scheduleId}` : "/work-schedule"}>View Schedule →</Link>
  </section>;
}

export function MaintenanceProgressRing({ item }: { item: EvaluatedMaintenanceTracker }) {
  const next = item.nextRule;
  const progress = next ? maintenanceProgressPercentage(next.currentValue, next.dueValue) : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);
  return <div className={`maintenance-ring maintenance-ring--${item.status.toLowerCase().replace("_", "-")}`} aria-label={`${item.componentName}: ${next ? `${formatMaintenanceValue(next.currentValue)} of ${formatMaintenanceValue(next.dueValue)} ${item.trackingUnit.toLowerCase()}` : "no active rule"}`}>
    <svg aria-hidden="true" viewBox="0 0 112 112"><circle className="maintenance-ring__track" cx="56" cy="56" r={radius} /><circle className="maintenance-ring__value" cx="56" cy="56" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} /></svg>
    <span><strong>{next ? formatMaintenanceValue(next.currentValue) : "—"}</strong><small>{next ? `/ ${formatMaintenanceValue(next.dueValue)} h` : "not configured"}</small></span>
  </div>;
}

function maintenanceMessage(item: EvaluatedMaintenanceTracker) {
  const next = item.nextRule;
  if (!next) return "No active rule";
  if (next.status === "OVERDUE") return `+${formatMaintenanceValue(next.overdueValue)} h overdue`;
  if (next.status === "DUE_WINDOW") return next.upperDueValue == null ? "Due now" : `Inside ${formatMaintenanceValue(next.dueValue)}–${formatMaintenanceValue(next.upperDueValue)} h window`;
  if (next.status === "DUE") return "Due now";
  return `${formatMaintenanceValue(next.remainingValue)} h remaining`;
}

function maintenanceCoverageSummary(item: EvaluatedMaintenanceTracker) {
  const count = item.runtimeCoverage.reportCount;
  return count === 0
    ? "No completed DDRs after anchor"
    : `${count} completed DDR${count === 1 ? "" : "s"} · verified history only`;
}

export function MaintenanceHealthCard({
  items,
  equipment,
  selectedEquipmentId,
  selectedEquipmentLabel,
  hiddenItemCount,
}: {
  items: EvaluatedMaintenanceTracker[];
  equipment: { id: string; label: string }[];
  selectedEquipmentId?: string;
  selectedEquipmentLabel?: string;
  hiddenItemCount: number;
}) {
  return <section className="dashboard-card dashboard-card--maintenance-health" aria-labelledby="maintenance-health-heading">
    <div className="section-heading"><div><p className="eyebrow">Equipment condition</p><h2 id="maintenance-health-heading">Maintenance Health</h2></div></div>
    {equipment.length > 0 ? <form className="maintenance-equipment-selector" method="get"><label><span>Dragline</span><select defaultValue={selectedEquipmentId} name="equipmentId">{equipment.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="button secondary" type="submit">View</button></form> : null}
    {items.length === 0 ? <div className="empty-state"><h3>{selectedEquipmentLabel ? "No configured components" : "No tracked draglines"}</h3><p>{selectedEquipmentLabel ? `No active maintenance components are tracked for ${selectedEquipmentLabel}.` : "Create an Equipment/component tracker to begin DDR-driven maintenance monitoring."}</p></div> : <div className="maintenance-health-grid">{items.map((item) => <Link className="maintenance-health-item" href={`/maintenance/${item.trackerId}`} key={item.trackerId}>
      <MaintenanceProgressRing item={item} />
      <div className="maintenance-health-item__body"><div className="maintenance-health-item__heading"><h3>{item.componentName}</h3><span className={statusClass(item.status)}>{maintenanceStatusLabel(item.status)}</span></div><strong className="maintenance-health-item__primary">{maintenanceMessage(item)}</strong><span className="subtle">Next: {item.nextRule?.rule.actionName ?? "No active action"}</span>{item.nextRule?.rule.counterScope === "SERVICE_INTERVAL" ? <span className="subtle">Lifecycle: {formatMaintenanceValue(item.lifecycleValue)} h</span> : null}<span className="maintenance-coverage-note" title={maintenanceRuntimeCoverageLabel(item.runtimeCoverage)}>{maintenanceCoverageSummary(item)}</span></div>
    </Link>)}</div>}
    {hiddenItemCount > 0 ? <p className="subtle">{hiddenItemCount} additional configured {hiddenItemCount === 1 ? "component is" : "components are"} available on the full Maintenance page.</p> : null}
    <Link className="table-action" href={selectedEquipmentId ? `/maintenance?equipmentId=${selectedEquipmentId}` : "/maintenance"}>View Maintenance →</Link>
  </section>;
}

export function FleetAttentionCard({ items }: { items: EvaluatedMaintenanceTracker[] }) {
  return <section className="dashboard-card dashboard-card--fleet-attention" aria-labelledby="fleet-attention-heading">
    <div className="section-heading"><div><p className="eyebrow">Fleet exceptions</p><h2 id="fleet-attention-heading">Fleet Attention</h2></div><span className="count-pill">{items.length}</span></div>
    {items.length === 0 ? <div className="maintenance-healthy"><span aria-hidden="true">✓</span><div><strong>No fleet exceptions</strong><p>Other tracked draglines are outside configured warning windows.</p></div></div> : <div className="dashboard-alert-list">{items.map((item) => <Link className="dashboard-alert dashboard-alert--link" href={`/maintenance/${item.trackerId}`} key={item.trackerId}><div className="section-heading"><div><strong>{item.equipmentLabel}</strong><span className="subtle">{item.componentName} · {item.nextRule?.rule.actionName}</span></div><span className={statusClass(item.status)}>{maintenanceStatusLabel(item.status)}</span></div><strong className={item.status === "OVERDUE" ? "maintenance-overdue-text" : ""}>{maintenanceMessage(item)}</strong></Link>)}</div>}
    <Link className="table-action" href="/maintenance">View Maintenance →</Link>
  </section>;
}

const quickActions = [
  ["New Delay Report", "/dragline-delay-reports/new"],
  ["Log Fuel Event", "/equipment-fuel-events/new"],
  ["New STOP Card", "/stop-cards/new"],
  ["View Schedule", "/work-schedule"],
  ["View Maintenance", "/maintenance"],
] as const;

export function QuickActionsCard() {
  return <section className="dashboard-card dashboard-card--wide" aria-labelledby="quick-actions-heading"><div><p className="eyebrow">Shortcuts</p><h2 id="quick-actions-heading">Quick Actions</h2></div><div className="quick-action-grid">{quickActions.map(([label, href], index) => <Link className={`button ${index === 0 ? "primary" : "secondary"}`} href={href} key={href}>{label}</Link>)}</div></section>;
}
