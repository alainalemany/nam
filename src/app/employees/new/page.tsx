import Link from "next/link";

import { EmployeeForm } from "@/features/employees/EmployeeForm";

export default function NewEmployeePage() {
  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Work Schedule Reference Data</p>
          <h1>Add Employee</h1>
          <p className="summary">Create one canonical Employee from authoritative personnel information.</p>
        </div>
        <Link className="button secondary" href="/employees">Back to Employees</Link>
      </section>
      <EmployeeForm />
    </main>
  );
}
