import Link from "next/link";

import { formatMinutes } from "@/features/timesheets/calculations";
import { timesheetStatusLabels } from "@/features/timesheets/constants";
import { getWeeklyTimesheets } from "@/features/timesheets/data";

export const dynamic = "force-dynamic";

function displayDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

export default async function TimesheetsPage() {
  const timesheets = await getWeeklyTimesheets();
  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div><p className="eyebrow">Personal Work Administration</p><h1 id="page-title">Timesheets</h1><p className="summary">Record payroll-week worked time and reconcile each day through ordered Work Allocations.</p></div>
        <Link className="button primary" href="/timesheets/new">Open Payroll Week</Link>
      </section>
      <section className="panel table-panel" aria-labelledby="timesheet-list-heading">
        <div className="section-heading"><h2 id="timesheet-list-heading">Payroll weeks</h2><span className="count-pill">{timesheets.length}</span></div>
        {timesheets.length === 0 ? (
          <div className="empty-state"><h3>No Timesheets yet</h3><p>Opening the entry screen does not create a record. The first save creates the payroll week and its entries atomically.</p><Link className="button primary" href="/timesheets/new">Enter worked time</Link></div>
        ) : (
          <div className="table-wrap"><table><thead><tr><th>Payroll week</th><th>Employee</th><th>Status</th><th>Entries</th><th>Worked</th><th>Regular</th><th>Overtime</th><th>Actions</th></tr></thead><tbody>
            {timesheets.map((item) => <tr key={item.id}><td>{displayDate(item.payrollWeekStartDate)} - {displayDate(item.payrollWeekEndDate)}</td><td>{item.primaryEmployeeDisplayName}</td><td>{timesheetStatusLabels[item.status]}</td><td>{item.entryCount}</td><td>{formatMinutes(item.workedMinutesTotal)}</td><td>{formatMinutes(item.regularMinutesTotal)}</td><td>{formatMinutes(item.overtimeMinutesTotal)}</td><td className="action-cell"><Link className="table-action" href={`/timesheets/${item.id}`}>View</Link>{item.status === "DRAFT" ? <Link className="table-action" href={`/timesheets/${item.id}/edit`}>Edit</Link> : null}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="panel"><div><h2>Timesheet reference data</h2><p>Manage reusable accounting references separately from weekly entry.</p><div className="inline-actions"><Link className="button secondary" href="/timesheets/work-codes">Work Codes</Link><Link className="button secondary" href="/timesheets/work-orders">Work Orders</Link><Link className="button secondary" href="/timesheets/support-personnel">Support Personnel</Link></div></div></section>
    </main>
  );
}

