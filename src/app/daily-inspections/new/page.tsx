import { createDailyInspectionAction } from "@/features/daily-inspections/actions";
import { getDailyInspectionFormOptions } from "@/features/daily-inspections/data";
import { DailyInspectionForm } from "@/features/daily-inspections/DailyInspectionForm";

export const dynamic = "force-dynamic";

export default async function NewDailyInspectionPage() {
  const { equipmentOptions, mineOptions } = await getDailyInspectionFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">New Daily Inspection</h1>
        <p className="summary">
          Record equipment condition, findings, and whether defects were
          identified.
        </p>
      </section>

      <section className="panel">
        <DailyInspectionForm
          action={createDailyInspectionAction}
          cancelHref="/daily-inspections"
          equipmentOptions={equipmentOptions}
          mineOptions={mineOptions}
          submitLabel="Create Daily Inspection"
        />
      </section>
    </main>
  );
}
