import { createEquipmentAction } from "@/features/equipment/actions";
import { getEquipmentMineOptions } from "@/features/equipment/data";
import { EquipmentForm } from "@/features/equipment/EquipmentForm";

export const dynamic = "force-dynamic";

export default async function NewEquipmentPage() {
  const mineOptions = await getEquipmentMineOptions();

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Reference data</p>
        <h1 id="page-title">New equipment</h1>
        <p className="summary">
          Add equipment to an existing Mine. City context is derived from the
          selected Mine.
        </p>
      </section>

      <section className="panel">
        <EquipmentForm
          action={createEquipmentAction}
          cancelHref="/equipment"
          mineOptions={mineOptions}
          submitLabel="Create Equipment"
        />
      </section>
    </main>
  );
}
