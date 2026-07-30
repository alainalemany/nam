import { notFound } from "next/navigation";

import { getSupervisorForEdit } from "@/features/supply-requests/reference-data";
import { SupervisorReferenceForm } from "@/features/supply-requests/ReferenceForms";
import { ReferenceStatusForm } from "@/features/supply-requests/ReferenceStatusForm";

export const dynamic = "force-dynamic";

export default async function EditSupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supervisor = await getSupervisorForEdit(id);
  if (!supervisor) notFound();

  return (
    <main className="page-stack">
      <section className="page-header">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Edit Supervisor</h1>
          <p className="summary">
            Changes affect future selection only. Historical request snapshots
            remain unchanged.
          </p>
        </div>
      </section>
      <SupervisorReferenceForm
        id={supervisor.id}
        initial={{ fullName: supervisor.fullName, email: supervisor.email }}
      />
      <section className="panel">
        <h2>
          {supervisor.active ? "Inactivate supervisor" : "Activate supervisor"}
        </h2>
        <p>
          {supervisor.active
            ? "The supervisor remains in historical records, will not be available for new Supply Requests, and does not change existing historical Supply Requests."
            : "Activation makes the supervisor available for new Supply Requests again."}
        </p>
        <p className="subtle">
          {supervisor.historicalUseCount} historical request versions use this
          supervisor.
        </p>
        <ReferenceStatusForm
          active={supervisor.active}
          id={supervisor.id}
          kind="supervisor"
        />
      </section>
    </main>
  );
}
