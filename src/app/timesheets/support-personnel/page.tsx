import Link from "next/link";

import { getTimesheetSupportPersonnel } from "@/features/timesheets/data";
import { SupportPersonForm } from "@/features/timesheets/ReferenceForm";

export const dynamic = "force-dynamic";

export default async function SupportPersonnelPage() {
  const records = await getTimesheetSupportPersonnel();
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Timesheet Reference Data</p><h1>Support Personnel</h1><p className="summary">A narrow directory for people supporting Work Allocations, not an Employee system.</p></div><Link className="button secondary" href="/timesheets">Back</Link></section><section className="panel form-stack"><h2>Add Support Person</h2><SupportPersonForm /></section><section className="record-list">{records.map((record) => <details className="record-card" key={record.id}><summary><strong>{record.displayName}</strong> · {record.tradeOrRole}<span className="subtle">{record.company ?? "No company"} · {record.active ? "Active" : "Inactive"} · {record._count.allocationLinks} historical allocations</span></summary><SupportPersonForm id={record.id} initial={{ displayName: record.displayName, tradeOrRole: record.tradeOrRole, company: record.company ?? "", notes: record.notes ?? "", active: record.active }} /></details>)}</section></main>;
}
