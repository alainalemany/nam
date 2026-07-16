import Link from "next/link";
import { notFound } from "next/navigation";

import { correctOperationalSafetyChecklistAction } from "@/features/operational-safety-checklists/actions";
import { getOperationalSafetyChecklistById, getSafetyChecklistEquipmentOptions, safetyChecklistToFormInitial } from "@/features/operational-safety-checklists/data";
import { OperationalSafetyChecklistForm } from "@/features/operational-safety-checklists/OperationalSafetyChecklistForm";

type CorrectChecklistPageProps = { params: Promise<{ id: string }> };

export default async function CorrectOperationalSafetyChecklistPage({ params }: CorrectChecklistPageProps) {
  const { id } = await params;
  const checklist = await getOperationalSafetyChecklistById(id);
  if (!checklist) notFound();
  const equipmentOptions = await getSafetyChecklistEquipmentOptions(
    checklist.equipmentId
      ? {
          id: checklist.equipmentId,
          templateKey: checklist.templateKey,
          templateVersion: checklist.templateVersion,
        }
      : undefined,
  );
  const action = correctOperationalSafetyChecklistAction.bind(null, id);

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Completed Checklist Correction</p><h1>Correct {checklist.templateName}</h1><p className="summary">The full checklist is revalidated and remains Completed. This does not create a Draft or a second inspection.</p></div>
        <Link className="button secondary" href={`/operational-safety-checklists/${id}`}>Back</Link>
      </section>
      <OperationalSafetyChecklistForm
        action={action}
        cancelHref={`/operational-safety-checklists/${id}`}
        equipmentOptions={equipmentOptions}
        initialValues={safetyChecklistToFormInitial(checklist)}
        submitLabel="Save Completed Correction"
        unavailableEquipmentLabel={
          checklist.equipmentId
            ? undefined
            : `${checklist.equipmentDisplayName}${
                checklist.equipmentNumber ? ` #${checklist.equipmentNumber}` : ""
              }`
        }
      />
    </main>
  );
}
