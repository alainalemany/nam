import Link from "next/link";
import { notFound } from "next/navigation";

import {
  optionLabel,
  shiftOptions,
  shiftReportStatusOptions,
} from "@/features/shift-reports/constants";
import { displayDateOnly } from "@/features/shift-reports/data";
import { prisma } from "@/lib/prisma";

type ShiftReportDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ShiftReportDetailPage({
  params,
}: ShiftReportDetailPageProps) {
  const { id } = await params;
  const report = await prisma.shiftReport.findUnique({
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

  if (!report) {
    notFound();
  }

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Shift Report</p>
          <h1 id="page-title">{displayDateOnly(report.reportDate)}</h1>
          <p className="summary">{report.summary}</p>
        </div>
        <Link className="button primary" href={`/shift-reports/${report.id}/edit`}>
          Edit Shift Report
        </Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="context-heading">
        <div>
          <p className="eyebrow">Shift</p>
          <h2 id="context-heading">{optionLabel(shiftOptions, report.shift)}</h2>
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p>{optionLabel(shiftReportStatusOptions, report.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Location</p>
          <p>{report.location ?? "Not recorded"}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="equipment-heading">
        <div>
          <p className="eyebrow">Equipment</p>
          <h2 id="equipment-heading">{report.equipment?.displayName ?? "Not set"}</h2>
        </div>
        <div>
          <p className="eyebrow">Mine</p>
          <p>
            {report.mine
              ? `${report.mine.name}, ${report.mine.city.name}`
              : "Not set"}
          </p>
        </div>
      </section>

      {report.operationalNotes ? (
        <section className="panel" aria-labelledby="notes-heading">
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="notes-heading">Operational notes</h2>
            <p>{report.operationalNotes}</p>
          </div>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="related-records-heading">
        <div>
          <p className="eyebrow">Related records</p>
          <h2 id="related-records-heading">Future module links</h2>
          <p className="summary">
            Work Authorizations and other related records are intentionally
            deferred until those relationships are implemented.
          </p>
        </div>
      </section>
    </main>
  );
}
