import Link from "next/link";
import { notFound } from "next/navigation";

import { getMaintenanceComponent } from "@/features/maintenance-tracking/data";
import { formatMaintenanceValue } from "@/features/maintenance-tracking/domain";
import { MaintenanceComponentForm } from "@/features/maintenance-tracking/MaintenanceComponentForm";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ saved?: string }> };

export default async function EditMaintenanceComponentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [component, query] = await Promise.all([getMaintenanceComponent(id), searchParams]);
  if (!component) notFound();
  return <main className="page-stack">
    <section className="page-header with-actions"><div><p className="eyebrow">Reference data</p><h1>{component.name}</h1><p className="summary">Manage component identity and service thresholds without changing application code.</p></div><Link className="button secondary" href="/reference-data/maintenance-components">Back to Components</Link></section>
    {query?.saved ? <div className="success-confirmation" role="status"><strong>{query.saved === "rule" ? "Maintenance rule saved." : "Tracked component saved."}</strong></div> : null}
    <section className="panel form-stack"><h2>Component</h2><MaintenanceComponentForm id={component.id} initial={{ name: component.name, description: component.description, trackingUnit: component.trackingUnit, active: component.active, sortOrder: component.sortOrder }} /></section>
    <section className="panel table-panel">
      <div className="section-heading"><div><p className="eyebrow">Configuration</p><h2>Maintenance Rules</h2></div><Link className="button primary" href={`/reference-data/maintenance-components/${component.id}/rules/new`}>New Rule</Link></div>
      {component.rules.length === 0 ? <div className="empty-state"><h3>No rules configured</h3><p>Add a threshold or service window before using this component operationally.</p></div> : <div className="table-wrap"><table><thead><tr><th>Action</th><th>Counter</th><th>Threshold</th><th>Warning</th><th>Repeat</th><th>Lifecycle</th><th>Actions</th></tr></thead><tbody>
        {component.rules.map((rule) => <tr key={rule.id}><td><strong>{rule.actionName}</strong><span className="subtle">{rule.active ? "Active" : "Inactive"} · Priority {rule.priority}</span></td><td>{rule.counterScope === "SERVICE_INTERVAL" ? "Service interval" : "Component lifecycle"}</td><td>{formatMaintenanceValue(Number(rule.thresholdValue))}{rule.upperThresholdValue ? `–${formatMaintenanceValue(Number(rule.upperThresholdValue))}` : ""} {component.trackingUnit.toLowerCase()}</td><td>{rule.warningLeadValue ? `${formatMaintenanceValue(Number(rule.warningLeadValue))} before` : "None"}</td><td>{rule.repeatable ? `Every ${formatMaintenanceValue(Number(rule.repeatIntervalValue))}${rule.maximumRepeatCount ? ` · max ${rule.maximumRepeatCount}` : ""}` : "No"}</td><td>{rule.startsNewLifecycle ? "Starts new lifecycle" : "Continues lifecycle"}</td><td><Link className="table-action" href={`/reference-data/maintenance-components/${component.id}/rules/${rule.id}/edit`}>Edit</Link></td></tr>)}
      </tbody></table></div>}
    </section>
  </main>;
}
