import Link from "next/link";
import { notFound } from "next/navigation";

import { getDraglineDelayReportById } from "@/features/dragline-delay-reports/data";
import { formatEventStartMinute } from "@/features/dragline-delay-reports/time";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export default async function DraglineDelayReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getDraglineDelayReportById(id);
  if (!report) notFound();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">
            {report.status === "DRAFT" ? "Draft" : "Completed"} · Version {report.recordVersion}
          </p>
          <h1>{report.equipmentDisplayName}</h1>
          <p className="summary">
            {displayDate(report.operationalWorkDate)} · {report.shift === "DAY" ? "Day" : "Night"} shift
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/dragline-delay-reports">
            Back
          </Link>
          {report.status === "DRAFT" ? (
            <Link
              className="button primary"
              href={`/dragline-delay-reports/${id}/edit`}
            >
              Edit Draft
            </Link>
          ) : null}
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-context-heading">
        <h2 id="ddr-context-heading">Report Context</h2>
        <div className="detail-grid full-width-field">
          <div>
            <p className="eyebrow">Equipment number</p>
            <p>{report.equipmentNumber ?? "Not recorded"}</p>
          </div>
          <div>
            <p className="eyebrow">Location</p>
            <p>
              {report.mineName} · {report.cityName}
              {report.cityState ? `, ${report.cityState}` : ""}
            </p>
          </div>
          <div>
            <p className="eyebrow">Starting Hour Meter</p>
            <p>{report.startingHourMeter.toLocaleString()}</p>
          </div>
          <div>
            <p className="eyebrow">Ending Hour Meter</p>
            <p>
              {report.endingHourMeter == null
                ? "Not recorded in Draft"
                : report.endingHourMeter.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="eyebrow">Operators</p>
            <p>
              {report.operators
                .map((operator) => operator.employeeDisplayName)
                .join(", ")}
            </p>
          </div>
          <div>
            <p className="eyebrow">Supervisor</p>
            <p>{report.supervisorDisplayName ?? "Not recorded in Draft"}</p>
          </div>
          <div>
            <p className="eyebrow">Down Time</p>
            <p>{report.downTimeMinutes} minutes</p>
          </div>
          <div>
            <p className="eyebrow">Run Time</p>
            <p>{report.runTimeMinutes} minutes</p>
          </div>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-timeline-detail-heading">
        <div className="section-heading">
          <h2 id="ddr-timeline-detail-heading">Operational Timeline</h2>
          <span className="count-pill">{report.timelineEntries.length}</span>
        </div>
        {report.timelineEntries.length === 0 ? (
          <div className="empty-state">
            <h3>No timeline entries yet</h3>
            <p>This Draft can be saved before the first operational activity is recorded.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Delay Code</th>
                  <th>Category</th>
                  <th>Duration</th>
                  <th>Downtime cause</th>
                  <th>Description / context</th>
                </tr>
              </thead>
              <tbody>
                {report.timelineEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatEventStartMinute(entry.startMinuteOffset)}</td>
                    <td>
                      {entry.delayCode} — {entry.delayCodeDescription}
                      <span className="subtle">
                        Catalog V{entry.delayCodeCatalogVersion}
                      </span>
                    </td>
                    <td>{entry.delayCodeCategory}</td>
                    <td>
                      {entry.durationMinutes == null
                        ? "Not recorded"
                        : `${entry.durationMinutes} min`}
                    </td>
                    <td>{entry.causesDowntime ? "Yes" : "No"}</td>
                    <td>{entry.description ?? "—"}</td>
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
