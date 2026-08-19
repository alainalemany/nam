import Link from "next/link";
import { notFound } from "next/navigation";

import { getDraglineDelayReportById } from "@/features/dragline-delay-reports/data";
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

  return (
    <main className="page-stack">
      {saved === "created" || saved === "updated" ? (
        <div className="success-confirmation" role="status">
          <p>Draft report saved successfully.</p>
        </div>
      ) : null}
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

      <section className="panel table-panel" aria-labelledby="ddr-production-detail-heading">
        <h2 id="ddr-production-detail-heading">Production and Progress</h2>
        <div className="detail-grid full-width-field">
          <div>
            <p className="eyebrow">Normal Digging Buckets</p>
            <p>{report.normalDiggingBuckets ?? "Not recorded in Draft"}</p>
          </div>
          <div>
            <p className="eyebrow">Benchfill Buckets</p>
            <p>{report.benchfillBuckets ?? "Not recorded in Draft"}</p>
          </div>
          <div>
            <p className="eyebrow">Lake</p>
            <p>
              {report.lakeDisplayNameSnapshot
                ? `${report.mineName} · ${report.lakeDisplayNameSnapshot}`
                : "Not recorded in Draft"}
            </p>
          </div>
          <div>
            <p className="eyebrow">Station Start</p>
            <p>
              {report.stationStartFeet == null
                ? "Not recorded in Draft"
                : formatStationNotation(report.stationStartFeet)}
            </p>
          </div>
          <div>
            <p className="eyebrow">Station End</p>
            <p>
              {report.stationEndFeet == null
                ? "Not recorded in Draft"
                : formatStationNotation(report.stationEndFeet)}
            </p>
          </div>
          <div>
            <p className="eyebrow">Advance</p>
            <p>
              {report.stationStartFeet == null || report.stationEndFeet == null
                ? "Not calculated in Draft"
                : `${calculateStationAdvance(report.stationStartFeet, report.stationEndFeet)} ft`}
            </p>
          </div>
          <div>
            <p className="eyebrow">Depth</p>
            <p>{report.depthFeet == null ? "Not recorded in Draft" : `${report.depthFeet} ft`}</p>
          </div>
          <div>
            <p className="eyebrow">Fuel</p>
            <p>{report.fuelGallons == null ? "Not recorded in Draft" : `${report.fuelGallons} gal`}</p>
          </div>
          <div>
            <p className="eyebrow">Cable Drag</p>
            <p>{report.cableDragFeet == null ? "Not recorded in Draft" : `${report.cableDragFeet} ft`}</p>
          </div>
          <div>
            <p className="eyebrow">Hoist</p>
            <p>{report.hoistFeet == null ? "Not recorded in Draft" : `${report.hoistFeet} ft`}</p>
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
          <p className="subtle">No Ground Checks recorded in this Draft.</p>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="ddr-closing-detail-heading">
        <h2 id="ddr-closing-detail-heading">Closing Notes</h2>
        <div className="detail-grid full-width-field">
          <div>
            <p className="eyebrow">Comments</p>
            <p>{report.comments ?? "Not recorded in Draft"}</p>
          </div>
          <div>
            <p className="eyebrow">Safety Items Found</p>
            <p>{report.safetyItemsFound ?? "Not recorded in Draft"}</p>
          </div>
          <div>
            <p className="eyebrow">Action Taken</p>
            <p>{report.actionTaken ?? "Not recorded in Draft"}</p>
          </div>
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
