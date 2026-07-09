import Link from "next/link";

import {
  optionLabel,
  shiftOptions,
  shiftReportStatusOptions,
} from "@/features/shift-reports/constants";
import { displayDateOnly, getShiftReports } from "@/features/shift-reports/data";

export const dynamic = "force-dynamic";

export default async function ShiftReportsPage() {
  const shiftReports = await getShiftReports();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Shift Reports</h1>
          <p className="summary">
            Shift-level operational summaries and coordination records.
          </p>
        </div>
        <Link className="button primary" href="/shift-reports/new">
          New Shift Report
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="shift-report-list-heading">
        <div className="section-heading">
          <h2 id="shift-report-list-heading">Shift Report records</h2>
          <span className="count-pill">{shiftReports.length}</span>
        </div>

        {shiftReports.length === 0 ? (
          <div className="empty-state">
            <h3>No Shift Reports yet</h3>
            <p>
              Create the first Shift Report to begin preserving shift-level
              operational summaries.
            </p>
            <Link className="button primary" href="/shift-reports/new">
              Add Shift Report
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Context</th>
                  <th scope="col">Status</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shiftReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <strong>{displayDateOnly(report.reportDate)}</strong>
                      <span className="subtle">
                        {optionLabel(shiftOptions, report.shift)}
                      </span>
                    </td>
                    <td>
                      {report.equipment?.displayName ?? report.location ?? "Not set"}
                      <span className="subtle">
                        {report.mine
                          ? `${report.mine.name}, ${report.mine.city.name}`
                          : "Mine not set"}
                      </span>
                    </td>
                    <td>{optionLabel(shiftReportStatusOptions, report.status)}</td>
                    <td>{report.summary}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/shift-reports/${report.id}`}>
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/shift-reports/${report.id}/edit`}
                      >
                        Edit
                      </Link>
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
