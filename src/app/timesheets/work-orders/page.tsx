import Link from "next/link";

import { getTimesheetReferenceEquipment, getTimesheetWorkOrders } from "@/features/timesheets/data";
import { WorkOrderForm } from "@/features/timesheets/ReferenceForm";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const [records, equipment] = await Promise.all([getTimesheetWorkOrders(), getTimesheetReferenceEquipment()]);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Timesheet Reference Data</p><h1>Work Orders</h1><p className="summary">Optional reusable maintenance and repair context for Work Allocations.</p></div><Link className="button secondary" href="/timesheets">Back</Link></section><section className="panel form-stack"><h2>Add Work Order</h2><WorkOrderForm equipment={equipment} /></section><section className="record-list">{records.map((record) => <details className="record-card" key={record.id}><summary><strong>{record.workOrderNumber}</strong> · {record.description}<span className="subtle">{record.active ? "Active" : "Inactive"} · {record._count.allocations} historical allocations</span></summary><WorkOrderForm id={record.id} equipment={equipment} initial={{ workOrderNumber: record.workOrderNumber, description: record.description, equipmentId: record.equipmentId ?? "", active: record.active }} /></details>)}</section></main>;
}

