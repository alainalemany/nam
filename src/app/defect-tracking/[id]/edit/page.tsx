import { notFound } from "next/navigation";

import { updateDefectAction } from "@/features/defect-tracking/actions";
import { dateInputValue, getDefect, getDefectFormOptions } from "@/features/defect-tracking/data";
import { DefectForm } from "@/features/defect-tracking/DefectForm";

type EditDefectPageProps = { params: Promise<{ id: string }> };

export default async function EditDefectPage({ params }: EditDefectPageProps) {
  const { id } = await params;
  const [defect, options] = await Promise.all([getDefect(id), getDefectFormOptions()]);
  if (!defect) notFound();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Edit Defect</h1>
        <p className="summary">Update defect details or move it through an allowed lifecycle transition.</p>
      </section>
      <section className="panel">
        <DefectForm
          action={updateDefectAction.bind(null, defect.id)}
          cancelHref={`/defect-tracking/${defect.id}`}
          equipmentOptions={options.equipmentOptions}
          inspectionOptions={options.inspectionOptions}
          initialValues={{
            reportedDate: dateInputValue(defect.reportedDate),
            equipmentId: defect.equipmentId,
            sourceDailyInspectionId: defect.sourceDailyInspectionId ?? "",
            severity: defect.severity,
            priority: defect.priority,
            status: defect.status,
            title: defect.title,
            description: defect.description,
            correctiveAction: defect.correctiveAction ?? "",
            resolutionSummary: defect.resolutionSummary ?? "",
          }}
          submitLabel="Save Defect"
        />
      </section>
    </main>
  );
}
