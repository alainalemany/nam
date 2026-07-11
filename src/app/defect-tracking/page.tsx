import Link from "next/link";

import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  optionLabel,
} from "@/features/defect-tracking/constants";
import { displayDateOnly, getDefects } from "@/features/defect-tracking/data";

export const dynamic = "force-dynamic";

export default async function DefectTrackingPage() {
  const defects = await getDefects();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Defect Tracking</h1>
          <p className="summary">Track equipment issues from reporting through resolution and closure.</p>
        </div>
        <Link className="button primary" href="/defect-tracking/new">New Defect</Link>
      </section>

      <section className="panel table-panel" aria-labelledby="defect-list-heading">
        <div className="section-heading">
          <h2 id="defect-list-heading">Defect records</h2>
          <span className="count-pill">{defects.length}</span>
        </div>

        {defects.length === 0 ? (
          <div className="empty-state">
            <h3>No defects yet</h3>
            <p>Create the first defect to begin tracking equipment issues and corrective work.</p>
            <Link className="button primary" href="/defect-tracking/new">Add Defect</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Defect</th><th>Equipment</th><th>Severity</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {defects.map((defect) => (
                  <tr key={defect.id}>
                    <td>{displayDateOnly(defect.reportedDate)}</td>
                    <td><strong>{defect.title}</strong><span className="subtle">{defect.description}</span></td>
                    <td>{defect.equipment.displayName}<span className="subtle">{defect.equipment.mine.name}</span></td>
                    <td>{optionLabel(defectSeverityOptions, defect.severity)}</td>
                    <td>{optionLabel(defectPriorityOptions, defect.priority)}</td>
                    <td>{optionLabel(defectStatusOptions, defect.status)}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/defect-tracking/${defect.id}`}>View</Link>
                      <Link className="table-action" href={`/defect-tracking/${defect.id}/edit`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
