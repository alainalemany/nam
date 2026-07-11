import Link from "next/link";
import { notFound } from "next/navigation";

import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  optionLabel,
} from "@/features/defect-tracking/constants";
import { displayDateOnly, displayDateTime, getDefect } from "@/features/defect-tracking/data";

type DefectDetailPageProps = { params: Promise<{ id: string }> };

export default async function DefectDetailPage({ params }: DefectDetailPageProps) {
  const { id } = await params;
  const defect = await getDefect(id);
  if (!defect) notFound();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Defect</p>
          <h1 id="page-title">{defect.title}</h1>
          <p className="summary">{defect.description}</p>
        </div>
        <Link className="button primary" href={`/defect-tracking/${defect.id}/edit`}>Edit Defect</Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="status-heading">
        <div><p className="eyebrow">Status</p><h2 id="status-heading">{optionLabel(defectStatusOptions, defect.status)}</h2></div>
        <div><p className="eyebrow">Reported</p><p>{displayDateOnly(defect.reportedDate)}</p></div>
        <div><p className="eyebrow">Severity</p><p>{optionLabel(defectSeverityOptions, defect.severity)}</p></div>
        <div><p className="eyebrow">Priority</p><p>{optionLabel(defectPriorityOptions, defect.priority)}</p></div>
      </section>

      <section className="panel detail-grid" aria-labelledby="equipment-heading">
        <div><p className="eyebrow">Equipment</p><h2 id="equipment-heading">{defect.equipment.displayName}</h2></div>
        <div><p className="eyebrow">Mine</p><p>{defect.equipment.mine.name}, {defect.equipment.mine.city.name}</p></div>
        <div><p className="eyebrow">Source inspection</p><p>{defect.sourceDailyInspection ? <Link className="table-action" href={`/daily-inspections/${defect.sourceDailyInspection.id}`}>{displayDateOnly(defect.sourceDailyInspection.inspectionDate)}</Link> : "Created directly"}</p></div>
      </section>

      <section className="panel" aria-labelledby="corrective-heading">
        <p className="eyebrow">Corrective information</p>
        <h2 id="corrective-heading">Corrective action</h2>
        <p>{defect.correctiveAction ?? "Not recorded"}</p>
      </section>

      <section className="panel detail-grid" aria-labelledby="resolution-heading">
        <div><p className="eyebrow">Resolution</p><h2 id="resolution-heading">Resolution summary</h2><p>{defect.resolutionSummary ?? "Not recorded"}</p></div>
        <div><p className="eyebrow">Resolved at</p><p>{displayDateTime(defect.resolvedAt)}</p></div>
        <div><p className="eyebrow">Closed at</p><p>{displayDateTime(defect.closedAt)}</p></div>
      </section>
    </main>
  );
}
