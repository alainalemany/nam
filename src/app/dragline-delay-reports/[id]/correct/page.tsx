import Link from "next/link";
import { notFound } from "next/navigation";

import { correctDraglineDelayReportAction } from "@/features/dragline-delay-reports/actions";
import {
  draglineDelayReportToFormInitial,
  getDraglineDelayReportFormOptions,
} from "@/features/dragline-delay-reports/data";
import { DraglineDelayReportForm } from "@/features/dragline-delay-reports/DraglineDelayReportForm";

export const dynamic = "force-dynamic";

export default async function CorrectDraglineDelayReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report, equipment, employees, supervisors, lakes } =
    await getDraglineDelayReportFormOptions(id);
  if (!report || report.status !== "COMPLETED") notFound();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Completed · Version {report.recordVersion}</p>
          <h1>Correct Dragline Delay Report</h1>
          <p className="summary">
            Correct the complete aggregate with a permanent reason. The report
            keeps its identity and remains Completed.
          </p>
        </div>
        <Link className="button secondary" href={`/dragline-delay-reports/${id}`}>
          Back
        </Link>
      </section>
      <DraglineDelayReportForm
        action={correctDraglineDelayReportAction.bind(null, id)}
        cancelHref={`/dragline-delay-reports/${id}`}
        employeeOptions={employees}
        equipmentOptions={equipment}
        initialValues={draglineDelayReportToFormInitial(report)}
        lakeOptions={lakes}
        mode="correction"
        submitLabel="Save Corrected Report"
        supervisorOptions={supervisors}
      />
    </main>
  );
}
