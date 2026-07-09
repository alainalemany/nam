import Link from "next/link";
import { notFound } from "next/navigation";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  optionLabel,
  shiftOptions,
} from "@/features/daily-inspections/constants";
import { displayDateOnly } from "@/features/daily-inspections/data";
import { prisma } from "@/lib/prisma";

type DailyInspectionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DailyInspectionDetailPage({
  params,
}: DailyInspectionDetailPageProps) {
  const { id } = await params;
  const inspection = await prisma.dailyInspection.findUnique({
    where: { id },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
  });

  if (!inspection) {
    notFound();
  }

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Daily Inspection</p>
          <h1 id="page-title">{displayDateOnly(inspection.inspectionDate)}</h1>
          <p className="summary">{inspection.findings}</p>
        </div>
        <Link className="button primary" href={`/daily-inspections/${inspection.id}/edit`}>
          Edit Daily Inspection
        </Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="context-heading">
        <div>
          <p className="eyebrow">Shift</p>
          <h2 id="context-heading">{optionLabel(shiftOptions, inspection.shift)}</h2>
        </div>
        <div>
          <p className="eyebrow">Condition</p>
          <p>{optionLabel(dailyInspectionConditionOptions, inspection.condition)}</p>
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p>{optionLabel(dailyInspectionStatusOptions, inspection.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Defects identified</p>
          <p>{inspection.defectsIdentified ? "Yes" : "No"}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="equipment-heading">
        <div>
          <p className="eyebrow">Equipment</p>
          <h2 id="equipment-heading">{inspection.equipment?.displayName ?? "Not set"}</h2>
        </div>
        <div>
          <p className="eyebrow">Mine</p>
          <p>
            {inspection.mine
              ? `${inspection.mine.name}, ${inspection.mine.city.name}`
              : "Not set"}
          </p>
        </div>
        <div>
          <p className="eyebrow">Equipment hours</p>
          <p>{inspection.equipmentHours ?? "Not recorded"}</p>
        </div>
      </section>

      {inspection.notes ? (
        <section className="panel" aria-labelledby="notes-heading">
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="notes-heading">Inspection notes</h2>
            <p>{inspection.notes}</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
