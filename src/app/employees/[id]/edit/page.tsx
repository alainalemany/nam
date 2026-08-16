import Link from "next/link";
import { notFound } from "next/navigation";

import { getEmployee } from "@/features/employees/data";
import { EmployeeForm } from "@/features/employees/EmployeeForm";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Work Schedule Reference Data</p>
          <h1>Edit Employee</h1>
          <p className="summary">
            Changes affect future selection. Historical Work Schedule name snapshots remain unchanged.
          </p>
        </div>
        <Link className="button secondary" href="/employees">Back to Employees</Link>
      </section>
      <EmployeeForm
        id={employee.id}
        initial={{
          displayName: employee.displayName,
          employeeCode: employee.employeeCode ?? "",
          isActive: employee.isActive,
          isSupervisor: employee.isSupervisor,
        }}
      />
    </main>
  );
}
