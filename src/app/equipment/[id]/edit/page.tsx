import { notFound } from "next/navigation";

import { updateEquipmentAction } from "@/features/equipment/actions";
import { EquipmentForm } from "@/features/equipment/EquipmentForm";
import { prisma } from "@/lib/prisma";

type EditEquipmentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const { id } = await params;
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      mine: {
        include: {
          city: true,
        },
      },
    },
  });

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
          Update the equipment record and its city or mine association.
        </p>
      </section>

      <section className="panel">
        <EquipmentForm
          action={updateAction}
          cancelHref="/equipment"
          initialValues={{
            cityName: equipment.mine.city.name,
            cityState: equipment.mine.city.state ?? "",
            mineName: equipment.mine.name,
            mineType: equipment.mine.type ?? "",
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
          submitLabel="Save Equipment"
        />
      </section>
    </main>
  );
}
