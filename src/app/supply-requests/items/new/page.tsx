import { SupplyItemReferenceForm } from "@/features/supply-requests/ReferenceForms";

export default function NewSupplyItemPage() {
  return (
    <main className="page-stack">
      <section className="page-header">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Add Supply Item</h1>
          <p className="summary">
            Create an active catalog item. Unit and Item Number become
            historical snapshots when a request is recorded.
          </p>
        </div>
      </section>
      <SupplyItemReferenceForm />
    </main>
  );
}
