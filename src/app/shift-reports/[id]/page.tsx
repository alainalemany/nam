import Link from "next/link";
import { notFound } from "next/navigation";

import {
  optionLabel,
  shiftOptions,
  shiftReportStatusOptions,
} from "@/features/shift-reports/constants";
import { displayDateOnly } from "@/features/shift-reports/data";
import {
  optionLabel as workAuthorizationOptionLabel,
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "@/features/work-authorizations/constants";
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
      workAuthorizations: {
        orderBy: [{ createdAt: "desc" }],
      },
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Related records</p>
            <h2 id="related-records-heading">Work Authorizations</h2>
          </div>
          <Link
            className="button primary"
            href={`/work-authorizations/new?shiftReportId=${report.id}`}
          >
            New Work Authorization
          </Link>
        </div>

        {report.workAuthorizations.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Authorizations for this Shift Report</h3>
            <p>
              Create Work Authorizations from this Shift Report when maintenance
              or safety work needs authorization context.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Work type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Description</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.workAuthorizations.map((authorization) => (
                  <tr key={authorization.id}>
                    <td>
                      {workAuthorizationOptionLabel(
                        workAuthorizationWorkTypeOptions,
                        authorization.workType,
                      )}
                    </td>
                    <td>
                      {workAuthorizationOptionLabel(
                        workAuthorizationStatusOptions,
                        authorization.status,
                      )}
                    </td>
                    <td>{authorization.workDescription}</td>
                    <td className="action-cell">
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}`}
                      >
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="future-records-heading">
        <div>
          <p className="eyebrow">Related records</p>
          <h2 id="future-records-heading">Future module links</h2>
          <p className="summary">
            Daily Logs, STOP Cards, Daily Inspections, and other related records
            remain independent and are intentionally deferred until those
            relationships are implemented.
          </p>
        </div>
      </section>
    </main>
  );
}
