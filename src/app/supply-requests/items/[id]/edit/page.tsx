import { notFound } from "next/navigation";

import { getSupplyItemForEdit } from "@/features/supply-requests/reference-data";
import { SupplyItemReferenceForm } from "@/features/supply-requests/ReferenceForms";
import { ReferenceStatusForm } from "@/features/supply-requests/ReferenceStatusForm";

export const dynamic = "force-dynamic";

export default async function EditSupplyItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getSupplyItemForEdit(id);
  if (!item) notFound();

  return (
    <main className="page-stack">
      <section className="page-header">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Edit Supply Item</h1>
          <p className="summary">
            Changes affect future selection only. Existing request snapshots
            remain unchanged.
          </p>
        </div>
      </section>
      <SupplyItemReferenceForm
        id={item.id}
        initial={{
          itemNumber: item.itemNumber,
          description: item.description,
          unitOfMeasure: item.unitOfMeasure,
        }}
      />
      <section className="panel">
        <h2>{item.active ? "Inactivate item" : "Activate item"}</h2>
        <p>
          {item.active
            ? "The item remains in historical records, will not be available for new Supply Requests, and does not change existing historical Supply Requests."
            : "Activation makes the item available for new Supply Requests again."}
        </p>
        <p className="subtle">
          {item.historicalUseCount} historical request versions use this item.
        </p>
        <ReferenceStatusForm active={item.active} id={item.id} kind="item" />
      </section>
    </main>
  );
}
