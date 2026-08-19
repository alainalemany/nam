import Link from "next/link";
import { notFound } from "next/navigation";

import { updateDraglineDelayReportAction } from "@/features/dragline-delay-reports/actions";
import {
  draglineDelayReportToFormInitial,
  getDraglineDelayReportFormOptions,
} from "@/features/dragline-delay-reports/data";
import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";

export const dynamic = "force-dynamic";

export default async function EditDraglineDelayReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report, equipment, employees, supervisors } =
    await getDraglineDelayReportFormOptions(id);
  if (!report || report.status !== "DRAFT") notFound();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Draft · Version {report.recordVersion}</p>
          <h1>Edit Dragline Delay Report</h1>
          <p className="summary">
            Retained timeline rows keep stable identities; stale saves are rejected.
          </p>
        </div>
        <Link className="button secondary" href={`/dragline-delay-reports/${id}`}>
          Back
        </Link>
      </section>
      <DraglineDelayReportForm
        action={updateDraglineDelayReportAction.bind(null, id)}
        cancelHref={`/dragline-delay-reports/${id}`}
        employeeOptions={employees}
        equipmentOptions={equipment}
        initialValues={draglineDelayReportToFormInitial(report)}
        submitLabel="Save Draft Changes"
        supervisorOptions={supervisors}
      />
    </main>
  );
}
