import { createShiftReportAction } from "@/features/shift-reports/actions";
import { getShiftReportFormOptions } from "@/features/shift-reports/data";
import { ShiftReportForm } from "@/features/shift-reports/ShiftReportForm";

export const dynamic = "force-dynamic";

export default async function NewShiftReportPage() {
  const { equipmentOptions, mineOptions } = await getShiftReportFormOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">New Shift Report</h1>
        <p className="summary">
          Record shift-level context, summary, equipment, and operational notes.
        </p>
      </section>

      <section className="panel">
        <ShiftReportForm
          action={createShiftReportAction}
          cancelHref="/shift-reports"
          equipmentOptions={equipmentOptions}
          mineOptions={mineOptions}
          submitLabel="Create Shift Report"
        />
      </section>
    </main>
  );
}
