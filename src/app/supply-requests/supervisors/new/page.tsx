import { SupervisorReferenceForm } from "@/features/supply-requests/ReferenceForms";

export default function NewSupervisorPage() {
  return (
    <main className="page-stack">
      <section className="page-header">
        <div>
          <p className="eyebrow">Supply Requests Reference Data</p>
          <h1>Add Supervisor</h1>
          <p className="summary">
            Create an active Supply Requests supervisor reference. This does
            not create a user, employee, approval, or email workflow.
          </p>
        </div>
      </section>
      <SupervisorReferenceForm />
    </main>
  );
}
