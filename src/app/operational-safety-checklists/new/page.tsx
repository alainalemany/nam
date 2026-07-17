import Link from "next/link";

import { createOperationalSafetyChecklistAction } from "@/features/operational-safety-checklists/actions";
import {
  getSafetyChecklistCreateAnotherInitial,
  getSafetyChecklistEquipmentOptions,
} from "@/features/operational-safety-checklists/data";
import { OperationalSafetyChecklistForm } from "@/features/operational-safety-checklists/OperationalSafetyChecklistForm";
import { safetyChecklistCreateAnotherSourceSchema } from "@/features/operational-safety-checklists/validation";

export const dynamic = "force-dynamic";

type NewChecklistPageProps = {
  searchParams?: Promise<{ from?: string | string[] }>;
};

export default async function NewOperationalSafetyChecklistPage({
  searchParams,
}: NewChecklistPageProps) {
  const source = safetyChecklistCreateAnotherSourceSchema.safeParse(
    (await searchParams)?.from,
  );
  const [equipmentOptions, initialValues] = await Promise.all([
    getSafetyChecklistEquipmentOptions(),
    source.success
      ? getSafetyChecklistCreateAnotherInitial(source.data)
      : Promise.resolve(undefined),
  ]);
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div><p className="eyebrow">Operational Safety Checklist</p><h1>Complete Pre-Shift Inspection</h1><p className="summary">Select the actual Equipment and consciously answer every approved checklist item.</p></div>
        <Link className="button secondary" href="/operational-safety-checklists">Back</Link>
      </section>
      <OperationalSafetyChecklistForm action={createOperationalSafetyChecklistAction} cancelHref="/operational-safety-checklists" equipmentOptions={equipmentOptions} initialValues={initialValues} submitLabel="Submit Completed Checklist" />
    </main>
  );
}
