import { createEquipmentAction } from "@/features/equipment/actions";
import { EquipmentForm } from "@/features/equipment/EquipmentForm";

export default function NewEquipmentPage() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Reference data</p>
        <h1 id="page-title">New equipment</h1>
        <p className="summary">
          Add equipment with its city and mine context. Existing city and mine
          records are reused when the names match.
        </p>
      </section>

      <section className="panel">
        <EquipmentForm
          action={createEquipmentAction}
          cancelHref="/equipment"
          submitLabel="Create Equipment"
        />
      </section>
    </main>
  );
}
