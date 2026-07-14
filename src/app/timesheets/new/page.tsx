import Link from "next/link";

import { dateInputValue, startOfPayrollWeek } from "@/features/timesheets/calculations";
import { getTimesheetFormOptions } from "@/features/timesheets/data";
import { TimesheetForm } from "@/features/timesheets/TimesheetForm";

export const dynamic = "force-dynamic";

export default async function NewTimesheetPage() {
  const options = await getTimesheetFormOptions();
  return (
    <main className="page-stack">
      <section className="page-header with-actions"><div><p className="eyebrow">Timesheet</p><h1>Enter Payroll Week</h1><p className="summary">The Weekly Timesheet is created only when this form is first saved.</p></div><Link className="button secondary" href="/timesheets">Back</Link></section>
      <TimesheetForm timesheetId={null} options={options} initial={{ payrollWeekStartDate: dateInputValue(startOfPayrollWeek(new Date())), primaryEmployeeDisplayName: "", entries: [] }} />
    </main>
  );
}

