import Link from "next/link";
import { notFound } from "next/navigation";

import {
  optionLabel,
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "@/features/work-authorizations/constants";
import { displayDateOnly } from "@/features/work-authorizations/data";
import { prisma } from "@/lib/prisma";

type WorkAuthorizationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

export default async function WorkAuthorizationDetailPage({
  params,
}: WorkAuthorizationDetailPageProps) {
  const { id } = await params;
  const authorization = await prisma.workAuthorization.findUnique({
    where: { id },
    include: {
      shiftReport: true,
      mine: {
        include: {
          city: true,
        },
      },
      equipment: true,
    },
  });

  if (!authorization) {
    notFound();
  }

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Work Authorization</p>
          <h1 id="page-title">
            {optionLabel(workAuthorizationWorkTypeOptions, authorization.workType)}
          </h1>
          <p className="summary">{authorization.workDescription}</p>
        </div>
        <Link
          className="button primary"
          href={`/work-authorizations/${authorization.id}/edit`}
        >
          Edit Work Authorization
        </Link>
      </section>

      <section className="panel detail-grid" aria-labelledby="context-heading">
        <div>
          <p className="eyebrow">Shift Report</p>
          <h2 id="context-heading">
            {displayDateOnly(authorization.shiftReport.reportDate)}
          </h2>
          <Link className="table-action" href={`/shift-reports/${authorization.shiftReportId}`}>
            Open Shift Report
          </Link>
        </div>
        <div>
          <p className="eyebrow">Status</p>
          <p>{optionLabel(workAuthorizationStatusOptions, authorization.status)}</p>
        </div>
        <div>
          <p className="eyebrow">Location</p>
          <p>{authorization.jobLocation ?? "Not recorded"}</p>
        </div>
        <div>
          <p className="eyebrow">Crew count</p>
          <p>{authorization.crewWorkerCount ?? "Not recorded"}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="equipment-heading">
        <div>
          <p className="eyebrow">Equipment</p>
          <h2 id="equipment-heading">
            {authorization.equipment?.displayName ?? "Not set"}
          </h2>
        </div>
        <div>
          <p className="eyebrow">Mine</p>
          <p>
            {authorization.mine
              ? `${authorization.mine.name}, ${authorization.mine.city.name}`
              : "Not set"}
          </p>
        </div>
        <div>
          <p className="eyebrow">Start</p>
          <p>{authorization.startTime ?? "Not recorded"}</p>
        </div>
        <div>
          <p className="eyebrow">End</p>
          <p>{authorization.endTime ?? "Not recorded"}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="permits-heading">
        <div>
          <p className="eyebrow">Lockout required</p>
          <h2 id="permits-heading">{yesNo(authorization.lockoutRequired)}</h2>
          {authorization.lockoutNotRequiredReason ? (
            <p>{authorization.lockoutNotRequiredReason}</p>
          ) : null}
        </div>
        <div>
          <p className="eyebrow">Workplace exam</p>
          <p>{yesNo(authorization.workplaceExamRequired)}</p>
        </div>
        <div>
          <p className="eyebrow">Hot work</p>
          <p>{yesNo(authorization.hotWorkRequired)}</p>
        </div>
        <div>
          <p className="eyebrow">Working at heights</p>
          <p>{yesNo(authorization.workingAtHeightsRequired)}</p>
        </div>
      </section>

      <section className="panel detail-grid" aria-labelledby="completion-heading">
        <div>
          <p className="eyebrow">Completion</p>
          <h2 id="completion-heading">{yesNo(authorization.jobCompleted)}</h2>
        </div>
        <div>
          <p className="eyebrow">Permits closed</p>
          <p>{yesNo(authorization.permitsClosed)}</p>
        </div>
        <div>
          <p className="eyebrow">Tools removed</p>
          <p>{yesNo(authorization.toolsRemoved)}</p>
        </div>
        <div>
          <p className="eyebrow">Supervisor notified</p>
          <p>{yesNo(authorization.supervisorNotified)}</p>
        </div>
      </section>

      {authorization.completionNotes ? (
        <section className="panel" aria-labelledby="completion-notes-heading">
          <div>
            <p className="eyebrow">Notes</p>
            <h2 id="completion-notes-heading">Completion notes</h2>
            <p>{authorization.completionNotes}</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
