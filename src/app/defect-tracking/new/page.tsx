import { createDefectAction } from "@/features/defect-tracking/actions";
import { getDefectFormOptions } from "@/features/defect-tracking/data";
import { DefectForm } from "@/features/defect-tracking/DefectForm";

export const dynamic = "force-dynamic";

export default async function NewDefectPage() {
  const options = await getDefectFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">New Defect</h1>
        <p className="summary">Report an equipment issue and classify its impact and urgency.</p>
      </section>
      <section className="panel">
        <DefectForm
          action={createDefectAction}
          cancelHref="/defect-tracking"
          equipmentOptions={options.equipmentOptions}
          inspectionOptions={options.inspectionOptions}
          submitLabel="Create Defect"
        />
      </section>
    </main>
  );
}
