import Link from "next/link";

import { getTimesheetReferenceEquipment, getTimesheetWorkCodes } from "@/features/timesheets/data";
import { WorkCodeForm } from "@/features/timesheets/ReferenceForm";

export const dynamic = "force-dynamic";

export default async function WorkCodesPage() {
  const [records, equipment] = await Promise.all([getTimesheetWorkCodes(), getTimesheetReferenceEquipment()]);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Timesheet Reference Data</p><h1>Work Codes</h1><p className="summary">Reusable accounting codes. Inactive codes remain visible in historical allocations.</p></div><Link className="button secondary" href="/timesheets">Back</Link></section><section className="panel form-stack"><h2>Add Work Code</h2><WorkCodeForm equipment={equipment} /></section><section className="record-list">{records.map((record) => <details className="record-card" key={record.id}><summary><strong>{record.code}</strong> · {record.description}<span className="subtle">{record.active ? "Active" : "Inactive"} · {record._count.allocations} historical allocations</span></summary><WorkCodeForm id={record.id} equipment={equipment} initial={{ code: record.code, description: record.description, category: record.category ?? "", equipmentId: record.equipmentId ?? "", active: record.active }} /></details>)}</section></main>;
}

