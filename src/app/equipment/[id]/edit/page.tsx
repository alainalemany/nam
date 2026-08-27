import { notFound } from "next/navigation";

import { updateEquipmentAction } from "@/features/equipment/actions";
import { getEquipmentMineOptions } from "@/features/equipment/data";
import { EquipmentForm } from "@/features/equipment/EquipmentForm";
import { prisma } from "@/lib/prisma";

type EditEquipmentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const { id } = await params;
  const [equipment, mineOptions] = await Promise.all([
    prisma.equipment.findUnique({
      where: { id },
    }),
    getEquipmentMineOptions(true),
  ]);

  if (!equipment) {
    notFound();
  }

  const updateAction = updateEquipmentAction.bind(null, equipment.id);

  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Reference data</p>
        <h1 id="page-title">Edit equipment</h1>
        <p className="summary">
          Update the equipment record or assign an existing Mine. City context
          follows the selected Mine.
        </p>
      </section>

      <section className="panel">
        <EquipmentForm
          action={updateAction}
          cancelHref="/equipment"
          initialValues={{
            mineId: equipment.mineId,
            displayName: equipment.displayName,
            equipmentNumber: equipment.equipmentNumber ?? "",
            category: equipment.category,
            make: equipment.make ?? "",
            model: equipment.model ?? "",
            powerType: equipment.powerType ?? "",
            instrumentationType: equipment.instrumentationType ?? "",
            hasDigitalAlarmScreen: equipment.hasDigitalAlarmScreen,
            status: equipment.status,
            notes: equipment.notes ?? "",
          }}
          mineOptions={mineOptions}
          submitLabel="Save Equipment"
        />
      </section>
    </main>
  );
}
