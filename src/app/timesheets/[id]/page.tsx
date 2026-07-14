import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMinutes } from "@/features/timesheets/calculations";
import { timesheetStatusLabels } from "@/features/timesheets/constants";
import { getWeeklyTimesheetById } from "@/features/timesheets/data";
import { CompleteTimesheetButton, DeleteTimesheetButton, ReopenTimesheetButton } from "@/features/timesheets/TimesheetLifecycleActions";

export const dynamic = "force-dynamic";

export default async function TimesheetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const timesheet = await getWeeklyTimesheetById(id);
  if (!timesheet) notFound();
  return (
    <main className="page-stack">
      <section className="page-header with-actions"><div><p className="eyebrow">Timesheet · {timesheetStatusLabels[timesheet.status]}</p><h1>{timesheet.primaryEmployeeDisplayName}</h1><p className="summary">{timesheet.payrollWeekStartDate.toISOString().slice(0, 10)} through {timesheet.payrollWeekEndDate.toISOString().slice(0, 10)}</p></div><div className="inline-actions"><Link className="button secondary" href="/timesheets">Back</Link>{timesheet.status === "DRAFT" ? <Link className="button secondary" href={`/timesheets/${id}/edit`}>Edit</Link> : null}{timesheet.status === "DRAFT" ? <CompleteTimesheetButton id={id} /> : <ReopenTimesheetButton id={id} />}{timesheet.status === "DRAFT" ? <DeleteTimesheetButton id={id} /> : null}</div></section>
      <section className="panel"><div><h2>Weekly totals</h2><dl className="meta-list"><dt>Worked</dt><dd>{formatMinutes(timesheet.workedMinutesTotal)}</dd><dt>Regular</dt><dd>{formatMinutes(timesheet.regularMinutesTotal)}</dd><dt>Overtime</dt><dd>{formatMinutes(timesheet.overtimeMinutesTotal)}</dd></dl></div></section>
      <section className="record-list" aria-label="Daily Time Entries">
        {timesheet.entries.length === 0 ? <div className="empty-state"><h3>No Daily Time Entries</h3><p>This Draft Timesheet does not contain worked time yet.</p></div> : timesheet.entries.map((entry) => {
          const allocated = entry.allocations.reduce((sum, item) => sum + item.allocatedMinutes, 0);
          return <article className="record-card" key={entry.id}><div className="section-heading"><div><h2>{entry.workDate.toISOString().slice(0, 10)}</h2><span className="subtle">{entry.clockIn} - {entry.clockOut} · {entry.unpaidBreakMinutes} minute break</span></div><span className="count-pill">{allocated === entry.workedMinutes ? "Reconciled" : `${formatMinutes(allocated)} / ${formatMinutes(entry.workedMinutes)}`}</span></div><dl className="meta-list"><dt>Primary equipment</dt><dd>{entry.primaryEquipmentDisplayNameSnapshot}{entry.primaryEquipmentNumberSnapshot ? ` #${entry.primaryEquipmentNumberSnapshot}` : ""}<span className="subtle">{entry.primaryMineNameSnapshot} · {entry.primaryCityNameSnapshot}{entry.primaryCityStateSnapshot ? `, ${entry.primaryCityStateSnapshot}` : ""}</span></dd><dt>Worked</dt><dd>{formatMinutes(entry.workedMinutes)}</dd><dt>Regular / Overtime</dt><dd>{formatMinutes(entry.regularMinutes)} / {formatMinutes(entry.overtimeMinutes)}</dd><dt>Work Schedule context</dt><dd>{entry.workScheduleDailyAssignment ? `${entry.workScheduleDailyAssignment.assignmentDate.toISOString().slice(0, 10)} · ${entry.workScheduleDailyAssignment.weeklySchedule.primaryEmployeeDisplayName}` : "Not linked"}</dd><dt>Notes</dt><dd>{entry.notes ?? "Not recorded"}</dd></dl><div className="table-wrap"><table><thead><tr><th>Seq.</th><th>Work Code</th><th>Work Order</th><th>Minutes</th><th>Support Personnel</th><th>Notes</th></tr></thead><tbody>{entry.allocations.map((allocation) => <tr key={allocation.id}><td>{allocation.sequence}</td><td>{allocation.workCodeSnapshot}<span className="subtle">{allocation.workCodeDescriptionSnapshot}</span></td><td>{allocation.workOrderSnapshot ?? "None"}{allocation.workOrderDescriptionSnapshot ? <span className="subtle">{allocation.workOrderDescriptionSnapshot}</span> : null}</td><td>{allocation.allocatedMinutes}</td><td>{allocation.supportPersonnel.length ? allocation.supportPersonnel.map((person) => `${person.supportPersonDisplayNameSnapshot} (${person.supportPersonTradeOrRoleSnapshot})`).join(", ") : "None"}</td><td>{allocation.notes ?? ""}</td></tr>)}</tbody></table></div></article>;
        })}
      </section>
    </main>
  );
}

