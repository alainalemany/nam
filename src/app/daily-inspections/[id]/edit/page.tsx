import { notFound } from "next/navigation";

import { updateDailyInspectionAction } from "@/features/daily-inspections/actions";
import {
  dateInputValue,
  getDailyInspectionFormOptions,
} from "@/features/daily-inspections/data";
import { DailyInspectionForm } from "@/features/daily-inspections/DailyInspectionForm";
import { prisma } from "@/lib/prisma";

type EditDailyInspectionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditDailyInspectionPage({
  params,
}: EditDailyInspectionPageProps) {
  const { id } = await params;
  const [inspection, options] = await Promise.all([
    prisma.dailyInspection.findUnique({
      where: { id },
    }),
    getDailyInspectionFormOptions(),
  ]);

  if (!inspection) {
    notFound();
  }

  const updateAction = updateDailyInspectionAction.bind(null, inspection.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Edit Daily Inspection</h1>
        <p className="summary">
          Update equipment condition, findings, status, or defect context.
        </p>
      </section>

      <section className="panel">
        <DailyInspectionForm
          action={updateAction}
          cancelHref={`/daily-inspections/${inspection.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={{
            inspectionDate: dateInputValue(inspection.inspectionDate),
            shift: inspection.shift,
            mineId: inspection.mineId ?? "",
            equipmentId: inspection.equipmentId ?? "",
            equipmentHours:
              inspection.equipmentHours === null ? "" : String(inspection.equipmentHours),
            condition: inspection.condition,
            status: inspection.status,
            findings: inspection.findings,
            defectsIdentified: inspection.defectsIdentified,
            notes: inspection.notes ?? "",
          }}
          mineOptions={options.mineOptions}
          submitLabel="Save Daily Inspection"
        />
      </section>
    </main>
  );
}
