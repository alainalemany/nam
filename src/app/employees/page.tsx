import Link from "next/link";

import { getEmployees } from "@/features/employees/data";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  return (
    <main className="page-stack">
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Work Schedule Reference Data</p>
          <h1>Employees</h1>
          <p className="summary">
            Maintain the canonical people available to Work Schedule employee and Assigned By selectors.
          </p>
        </div>
        <Link className="button primary" href="/employees/new">Add Employee</Link>
      </section>

      <section className="panel">
        <h2>Reference retirement</h2>
        <p>
          Inactivate an employee to remove them from normal new selections. Existing schedule relationships and historical name snapshots remain unchanged.
        </p>
      </section>

      <section className="panel table-panel" aria-labelledby="employee-list-heading">
        <div className="section-heading">
          <h2 id="employee-list-heading">Employee references</h2>
          <span className="count-pill">{employees.length}</span>
        </div>
        {employees.length === 0 ? (
          <div className="empty-state">
            <h3>No employees yet</h3>
            <p>Add an Employee using authoritative personnel information.</p>
            <Link className="button primary" href="/employees/new">Add Employee</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Display Name</th>
                  <th scope="col">Employee Code</th>
                  <th scope="col">Active</th>
                  <th scope="col">Supervisor</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td><strong>{employee.displayName}</strong></td>
                    <td>{employee.employeeCode ?? "Not recorded"}</td>
                    <td>{employee.isActive ? "Yes" : "No"}</td>
                    <td>{employee.isSupervisor ? "Yes" : "No"}</td>
                    <td>
                      <Link className="table-action" href={`/employees/${employee.id}/edit`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
