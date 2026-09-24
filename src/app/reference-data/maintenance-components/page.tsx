import Link from "next/link";

import { formatMaintenanceValue } from "@/features/maintenance-tracking/domain";
import { getMaintenanceComponents } from "@/features/maintenance-tracking/data";

export const dynamic = "force-dynamic";

export default async function MaintenanceComponentsPage() {
  const components = await getMaintenanceComponents();
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Reference data</p><h1>Tracked Maintenance Components</h1><p className="summary">Configure reusable component types and their data-driven service rules.</p></div>
        <Link className="button primary" href="/reference-data/maintenance-components/new">New Component</Link>
      </section>
      <section className="panel table-panel">
        <div className="section-heading"><h2>Components</h2><span className="count-pill">{components.length}</span></div>
        {components.length === 0 ? <div className="empty-state"><h3>No tracked components</h3><p>Add the first maintenance component and its service rules.</p></div> : (
          <div className="table-wrap"><table><thead><tr><th>Component</th><th>Unit</th><th>Rules</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {components.map((component) => <tr key={component.id}>
              <td><strong>{component.name}</strong>{component.description ? <span className="subtle">{component.description}</span> : null}</td>
              <td>{component.trackingUnit}</td>
              <td>{component.rules.length}{component.rules[0] ? <span className="subtle">First at {formatMaintenanceValue(Number(component.rules[0].thresholdValue))}</span> : null}</td>
              <td>{component.active ? "Active" : "Inactive"}</td>
              <td><Link className="table-action" href={`/reference-data/maintenance-components/${component.id}/edit`}>Manage</Link></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
