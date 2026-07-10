import { notFound } from "next/navigation";

import { updateWorkAuthorizationAction } from "@/features/work-authorizations/actions";
import { getWorkAuthorizationFormOptions } from "@/features/work-authorizations/data";
import { WorkAuthorizationForm } from "@/features/work-authorizations/WorkAuthorizationForm";
import { prisma } from "@/lib/prisma";

type EditWorkAuthorizationPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditWorkAuthorizationPage({
  params,
}: EditWorkAuthorizationPageProps) {
  const { id } = await params;
  const [authorization, options] = await Promise.all([
    prisma.workAuthorization.findUnique({
      where: { id },
    }),
    getWorkAuthorizationFormOptions(),
  ]);

  if (!authorization) {
    notFound();
  }

  const updateAction = updateWorkAuthorizationAction.bind(null, authorization.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Edit Work Authorization</h1>
        <p className="summary">
          Update work details, permits, lockout context, or completion status.
        </p>
      </section>

      <section className="panel">
        <WorkAuthorizationForm
          action={updateAction}
          cancelHref={`/work-authorizations/${authorization.id}`}
          equipmentOptions={options.equipmentOptions}
          initialValues={{
            shiftReportId: authorization.shiftReportId,
            status: authorization.status,
            workType: authorization.workType,
            mineId: authorization.mineId ?? "",
            equipmentId: authorization.equipmentId ?? "",
            jobLocation: authorization.jobLocation ?? "",
            workDescription: authorization.workDescription,
            startTime: authorization.startTime ?? "",
            endTime: authorization.endTime ?? "",
            crewWorkerCount:
              authorization.crewWorkerCount === null
                ? ""
                : String(authorization.crewWorkerCount),
            contactName: authorization.contactName ?? "",
            equipmentRequired: authorization.equipmentRequired ?? "",
            personInChargeName: authorization.personInChargeName ?? "",
            lockoutRequired: authorization.lockoutRequired,
            lockoutNotRequiredReason: authorization.lockoutNotRequiredReason ?? "",
            workplaceExamRequired: authorization.workplaceExamRequired,
            confinedSpaceRequired: authorization.confinedSpaceRequired,
            lockoutTagoutRequired: authorization.lockoutTagoutRequired,
            hotWorkRequired: authorization.hotWorkRequired,
            workingAtHeightsRequired: authorization.workingAtHeightsRequired,
            stopCardJhaRequired: authorization.stopCardJhaRequired,
            jobCompleted: authorization.jobCompleted,
            permitsClosed: authorization.permitsClosed,
            guardsReplaced: authorization.guardsReplaced,
            lockoutTagoutRemoved: authorization.lockoutTagoutRemoved,
            toolsRemoved: authorization.toolsRemoved,
            housekeepingCompleted: authorization.housekeepingCompleted,
            supervisorNotified: authorization.supervisorNotified,
            completionNotes: authorization.completionNotes ?? "",
          }}
          mineOptions={options.mineOptions}
          shiftReportOptions={options.shiftReportOptions}
          submitLabel="Save Work Authorization"
        />
      </section>
    </main>
  );
}
