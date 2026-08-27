import Link from "next/link";

import { getDraglineDelayReports } from "@/features/dragline-delay-reports/data";
import { formatDraglineDurationMinutes } from "@/features/dragline-delay-reports/duration";

export const dynamic = "force-dynamic";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export default async function DraglineDelayReportsPage() {
  const reports = await getDraglineDelayReports();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Dragline Operations</p>
          <h1>Dragline Delay Reports</h1>
          <p className="summary">
            Independent shift reports with actual-time activity and authoritative
            runtime and downtime totals.
          </p>
        </div>
        <Link className="button primary" href="/dragline-delay-reports/new">
          Create Draft Report
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-history-heading">
        <div className="section-heading">
          <h2 id="ddr-history-heading">Report History</h2>
          <span className="count-pill">{reports.length}</span>
        </div>
        {reports.length === 0 ? (
          <div className="empty-state">
            <h3>No Dragline Delay Reports yet</h3>
            <p>Create the first Draft near the start of a dragline shift.</p>
            <Link className="button primary" href="/dragline-delay-reports/new">
              Create Draft Report
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Operational date</th>
                  <th>Equipment</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Run / Down</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{displayDate(report.operationalWorkDate)}</td>
                    <td>
                      {report.equipmentDisplayName}
                      <span className="subtle">
                        {report.equipmentNumber ?? "No Equipment number"} · {report.mineName}
                      </span>
                    </td>
                    <td>{report.shift === "DAY" ? "Day" : "Night"}</td>
                    <td>
                      <span
                        className={`ddr-status-badge ddr-status-badge--${report.status.toLowerCase()}`}
                      >
                        {report.status === "DRAFT" ? "Draft" : "Completed"}
                      </span>
                    </td>
                    <td>
                      {formatDraglineDurationMinutes(report.runTimeMinutes)} /{" "}
                      {formatDraglineDurationMinutes(report.downTimeMinutes)}
                      <span className="subtle">Run / Down</span>
                    </td>
                    <td>{report.updatedAt.toLocaleString("en-US")}</td>
                    <td className="action-cell">
                      <Link
                        className="table-action"
                        href={`/dragline-delay-reports/${report.id}`}
                      >
                        View
                      </Link>
                      {report.status === "DRAFT" ? (
                        <Link
                          className="table-action"
                          href={`/dragline-delay-reports/${report.id}/edit`}
                        >
                          Edit Draft
                        </Link>
                      ) : null}
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
