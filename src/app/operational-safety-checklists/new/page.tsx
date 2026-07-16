import Link from "next/link";

import { createOperationalSafetyChecklistAction } from "@/features/operational-safety-checklists/actions";
import { getSafetyChecklistEquipmentOptions } from "@/features/operational-safety-checklists/data";
import { OperationalSafetyChecklistForm } from "@/features/operational-safety-checklists/OperationalSafetyChecklistForm";

export const dynamic = "force-dynamic";

export default async function NewOperationalSafetyChecklistPage() {
  const equipmentOptions = await getSafetyChecklistEquipmentOptions();
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Operational Safety Checklist</p><h1>Complete Pre-Shift Inspection</h1><p className="summary">Select the actual Equipment and consciously answer every approved checklist item.</p></div>
        <Link className="button secondary" href="/operational-safety-checklists">Back</Link>
      </section>
      <OperationalSafetyChecklistForm action={createOperationalSafetyChecklistAction} cancelHref="/operational-safety-checklists" equipmentOptions={equipmentOptions} submitLabel="Submit Completed Checklist" />
    </main>
  );
}
