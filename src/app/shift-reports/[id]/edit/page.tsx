import { notFound } from "next/navigation";

import { updateShiftReportAction } from "@/features/shift-reports/actions";
import {
  dateInputValue,
  getShiftReportFormOptions,
} from "@/features/shift-reports/data";
import { ShiftReportForm } from "@/features/shift-reports/ShiftReportForm";
import { prisma } from "@/lib/prisma";

type EditShiftReportPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditShiftReportPage({ params }: EditShiftReportPageProps) {
  const { id } = await params;
  const [report, options] = await Promise.all([
    prisma.shiftReport.findUnique({
      where: { id },
    }),
    getShiftReportFormOptions(),
  ]);

  if (!report) {
    notFound();
  }

  const updateAction = updateShiftReportAction.bind(null, report.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Edit Shift Report</h1>
        <p className="summary">
          Update shift context, status, summary, or operational notes.
        </p>
      </section>

      <section className="panel">
        <ShiftReportForm
          action={updateAction}
          cancelHref={`/shift-reports/${report.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={{
            reportDate: dateInputValue(report.reportDate),
            shift: report.shift,
            status: report.status,
            mineId: report.mineId ?? "",
            equipmentId: report.equipmentId ?? "",
            location: report.location ?? "",
            summary: report.summary,
            operationalNotes: report.operationalNotes ?? "",
          }}
          mineOptions={options.mineOptions}
          submitLabel="Save Shift Report"
        />
      </section>
    </main>
  );
}
