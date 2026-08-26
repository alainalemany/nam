import Link from "next/link";
import { notFound } from "next/navigation";

import { getDraglineDelayReportById } from "@/features/dragline-delay-reports/data";
import { formatDraglineDurationMinutes } from "@/features/dragline-delay-reports/duration";
import { calculateStationAdvance, formatStationNotation } from "@/features/dragline-delay-reports/station";
import { formatEventStartMinute } from "@/features/dragline-delay-reports/time";

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export default async function DraglineDelayReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const report = await getDraglineDelayReportById(id);
  if (!report) notFound();
  const missingLabel = report.status === "DRAFT" ? "Not recorded in Draft" : "Not recorded";

  return (
    <main className="page-stack">
      {saved === "created" || saved === "updated" || saved === "completed" || saved === "corrected" ? (
        <div className="success-confirmation" role="status">
          <p>
            {saved === "completed"
              ? "Report completed successfully."
              : saved === "corrected"
                ? "Report corrected successfully."
                : "Draft report saved successfully."}
          </p>
        </div>
      ) : null}
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">
            {report.status === "DRAFT" ? "Draft" : "Completed"} · Version {report.recordVersion}
          </p>
          <h1>
            {displayDate(report.operationalWorkDate)} · {report.shift === "DAY" ? "Day" : "Night"} shift
          </h1>
          <p className="summary">{report.equipmentDisplayName}</p>
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
          ) : (
            <Link
              className="button primary"
              href={`/dragline-delay-reports/${id}/correct`}
            >
              Correct Report
            </Link>
          )}
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
                ? missingLabel
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
            <p>{report.supervisorDisplayName ?? missingLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Completed</p>
            <p>
              {report.completedAt
                ? report.completedAt.toLocaleString("en-US")
                : "Not completed"}
            </p>
          </div>
          <div>
            <p className="eyebrow">Down Time</p>
            <p>{formatDraglineDurationMinutes(report.downTimeMinutes)}</p>
          </div>
          <div>
            <p className="eyebrow">Run Time</p>
            <p>{formatDraglineDurationMinutes(report.runTimeMinutes)}</p>
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

      <section className="panel table-panel" aria-labelledby="ddr-production-detail-heading">
        <h2 id="ddr-production-detail-heading">Production and Progress</h2>
        <div className="detail-grid full-width-field">
          <div>
            <p className="eyebrow">Normal Digging Buckets</p>
            <p>{report.normalDiggingBuckets ?? missingLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Benchfill Buckets</p>
            <p>{report.benchfillBuckets ?? missingLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Lake</p>
            <p>
              {report.lakeDisplayNameSnapshot
                ? `${report.mineName} · ${report.lakeDisplayNameSnapshot}`
                : missingLabel}
            </p>
          </div>
          <div>
            <p className="eyebrow">Section Start</p>
            <p>
              {report.stationStartFeet == null
                ? missingLabel
                : formatStationNotation(report.stationStartFeet)}
            </p>
          </div>
          <div>
            <p className="eyebrow">Section End</p>
            <p>
              {report.stationEndFeet == null
                ? missingLabel
                : formatStationNotation(report.stationEndFeet)}
            </p>
          </div>
          <div>
            <p className="eyebrow">Advance</p>
            <p>
              {report.stationStartFeet == null || report.stationEndFeet == null
                ? report.status === "DRAFT" ? "Not calculated in Draft" : "Not calculated"
                : `${calculateStationAdvance(report.stationStartFeet, report.stationEndFeet)} ft`}
            </p>
          </div>
          <div>
            <p className="eyebrow">Depth</p>
            <p>{report.depthFeet == null ? missingLabel : `${report.depthFeet} ft`}</p>
          </div>
          <div>
            <p className="eyebrow">Fuel</p>
            <p>{report.fuelGallons == null ? missingLabel : `${report.fuelGallons} gal`}</p>
          </div>
          <div>
            <p className="eyebrow">Cable Drag</p>
            <p>{report.cableDragFeet == null ? missingLabel : `${report.cableDragFeet} ft`}</p>
          </div>
          <div>
            <p className="eyebrow">Hoist</p>
            <p>{report.hoistFeet == null ? missingLabel : `${report.hoistFeet} ft`}</p>
          </div>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-ground-check-detail-heading">
        <div className="section-heading">
          <h2 id="ddr-ground-check-detail-heading">Ground Checks</h2>
          <span className="count-pill">{report.groundChecks.length}</span>
        </div>
        {report.groundChecks.length ? (
          <ol>
            {report.groundChecks.map((groundCheck) => (
              <li key={groundCheck.id}>{formatEventStartMinute(groundCheck.startMinuteOffset)}</li>
            ))}
          </ol>
        ) : (
          <p className="subtle">No Ground Checks recorded.</p>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-closing-detail-heading">
        <h2 id="ddr-closing-detail-heading">Closing Notes</h2>
        <div className="detail-grid full-width-field">
          <div>
            <p className="eyebrow">Comments</p>
            <p>{report.comments ?? missingLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Safety Items Found</p>
            <p>{report.safetyItemsFound ?? missingLabel}</p>
          </div>
          <div>
            <p className="eyebrow">Action Taken</p>
            <p>{report.actionTaken ?? missingLabel}</p>
          </div>
        </div>
      </section>

      {report.status === "COMPLETED" ? (
        <section className="panel table-panel" aria-labelledby="ddr-correction-history-heading">
          <div className="section-heading">
            <h2 id="ddr-correction-history-heading">Correction History</h2>
            <span className="count-pill">{report.corrections.length}</span>
          </div>
          {report.corrections.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Correction</th>
                    <th>Corrected</th>
                    <th>Version</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {report.corrections.map((correction) => (
                    <tr key={correction.id}>
                      <td>{correction.sequence}</td>
                      <td>{correction.correctedAt.toLocaleString("en-US")}</td>
                      <td>
                        {correction.previousRecordVersion} → {correction.resultingRecordVersion}
                      </td>
                      <td>{correction.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subtle">This Completed report has not been corrected.</p>
          )}
        </section>
      ) : null}

    </main>
  );
}
