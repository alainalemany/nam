import Link from "next/link";
import { notFound } from "next/navigation";

import { formatMinutes } from "@/features/timesheets/calculations";
import { timesheetStatusLabels } from "@/features/timesheets/constants";
import { getTimesheetCompletionReview, getWeeklyTimesheetById, timesheetToFormInput } from "@/features/timesheets/data";
import { TimesheetCopyDayButton } from "@/features/timesheets/TimesheetCopyDayButton";
import {
  CompleteTimesheetButton,
  DeleteTimesheetButton,
  ReopenTimesheetButton,
} from "@/features/timesheets/TimesheetLifecycleActions";

export const dynamic = "force-dynamic";

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

export default async function TimesheetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ savedDate?: string; saved?: string; completed?: string }> }) {
  const { id } = await params;
  const query: { savedDate?: string; saved?: string; completed?: string } = await (searchParams ?? Promise.resolve({}));
  const timesheet = await getWeeklyTimesheetById(id);
  if (!timesheet) notFound();

  const trustedIdentity = ["EXPLICIT_SELECTION", "OWNER_VERIFIED"].includes(
    timesheet.primaryEmployeeIdentityStatus,
  );
  const formInput = timesheetToFormInput(timesheet);
  const entriesByDate = new Map(formInput.entries.map((entry) => [entry.workDate, entry]));
  const leaveByDate = new Map(formInput.leaveEntries.map((entry) => [entry.workDate, entry]));
  const noWorkByDate = new Map((formInput.noWorkEntries ?? []).map((entry) => [entry.workDate, entry]));
  const persistedLeaveEntries = timesheet.leaveEntries ?? [];
  const dates = [...new Set([...entriesByDate.keys(), ...leaveByDate.keys(), ...noWorkByDate.keys()])].sort();
  const requestedFtoMinutes = formInput.leaveEntries.reduce(
    (sum, entry) => sum + entry.requestedMinutes,
    0,
  );
  const completionReview = timesheet.status === "DRAFT" && trustedIdentity
    ? await getTimesheetCompletionReview(timesheet)
    : { issues: [] };

  return (
    <main className="page-stack">
      {query.savedDate ? <div className="form-message success" role="status">Timesheet for {displayDate(query.savedDate)} saved successfully.</div> : null}
      {query.saved === "week" ? <div className="form-message success" role="status">Timesheet week saved successfully.</div> : null}
      {query.completed === "1" ? <div className="form-message success" role="status">Timesheet completed successfully. This week is now read-only.</div> : null}
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">
            Timesheet · {timesheetStatusLabels[timesheet.status]}
            {trustedIdentity ? "" : " · Needs Review"}
          </p>
          <h1>{timesheet.primaryEmployeeDisplayName}</h1>
          <p className="summary">
            {timesheet.payrollWeekStartDate.toISOString().slice(0, 10)} through{" "}
            {timesheet.payrollWeekEndDate.toISOString().slice(0, 10)}
          </p>
          {trustedIdentity ? null : (
            <p className="form-message error">
              Historical ownership must be reviewed before this Timesheet can be changed. It is
              readable, but it is not confirmed Payroll evidence for any Employee.
            </p>
          )}
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/timesheets">Back</Link>
          {trustedIdentity && timesheet.status === "DRAFT" ? (
            <Link className="button secondary" href={`/timesheets/${id}/edit`}>Edit</Link>
          ) : null}
          {trustedIdentity && timesheet.status === "DRAFT" ? (
            <CompleteTimesheetButton
              id={id}
              weekLabel={`${displayDate(timesheet.payrollWeekStartDate.toISOString().slice(0, 10))}–${displayDate(timesheet.payrollWeekEndDate.toISOString().slice(0, 10))}`}
              workedTime={formatMinutes(timesheet.workedMinutesTotal)}
              ftoSummary={formInput.leaveEntries.length ? `${formInput.leaveEntries.length} request(s), ${formatMinutes(requestedFtoMinutes)}` : "None"}
              noWorkSummary={timesheet.noWorkEntries.length ? timesheet.noWorkEntries.map((entry) => `${displayDate(entry.workDate.toISOString().slice(0, 10))}: ${entry.reason === "SHIFT_CANCELED" ? "Shift canceled" : "Covered by coworker"}`).join("; ") : "None"}
              issues={completionReview.issues}
            />
          ) : trustedIdentity ? (
            <ReopenTimesheetButton id={id} />
          ) : null}
          {trustedIdentity && timesheet.status === "DRAFT" ? (
            <DeleteTimesheetButton id={id} />
          ) : null}
        </div>
      </section>

      <section className="panel">
        <h2>Weekly totals</h2>
        <dl className="meta-list">
          <dt>Worked</dt><dd>{formatMinutes(timesheet.workedMinutesTotal)}</dd>
          <dt>Regular</dt><dd>{formatMinutes(timesheet.regularMinutesTotal)}</dd>
          <dt>Overtime</dt><dd>{formatMinutes(timesheet.overtimeMinutesTotal)}</dd>
          <dt>FTO requested</dt><dd>{formatMinutes(requestedFtoMinutes)}</dd>
        </dl>
        <p className="subtle">
          Requested FTO is separate from worked-time totals and is not proof of approval or payment.
        </p>
      </section>

      <section className="record-list" aria-label="Timesheet daily records">
        {dates.length === 0 ? (
          <div className="empty-state">
            <h3>No daily records</h3>
            <p>This Draft Timesheet does not contain worked time or FTO requests yet.</p>
          </div>
        ) : dates.map((date) => {
          const entry = timesheet.entries.find(
            (item) => item.workDate.toISOString().slice(0, 10) === date,
          );
          const leave = persistedLeaveEntries.find(
            (item) => item.workDate.toISOString().slice(0, 10) === date,
          );
          const noWork = timesheet.noWorkEntries.find(
            (item) => item.workDate.toISOString().slice(0, 10) === date,
          );
          const entryInput = entriesByDate.get(date);
          const leaveInput = leaveByDate.get(date);
          const allocated = entry?.allocations.reduce(
            (sum, item) => sum + item.allocatedMinutes,
            0,
          ) ?? 0;

          return (
            <article className="record-card" key={date}>
              <div className="section-heading">
                <h2>{date}</h2>
                {trustedIdentity && timesheet.primaryEmployeeId ? (
                  <TimesheetCopyDayButton
                    sourceDate={date}
                    employeeId={timesheet.primaryEmployeeId}
                    workedEntry={entryInput}
                    leaveEntry={leaveInput}
                  />
                ) : null}
              </div>

              {entry ? (
                <div className="form-stack">
                  <div className="section-heading">
                    <div>
                      <h3>Worked time</h3>
                      <span className="subtle">
                        {entry.clockIn} - {entry.clockOut} · {entry.unpaidBreakMinutes} minute break
                      </span>
                    </div>
                    <span className="count-pill">
                      {allocated === entry.workedMinutes
                        ? "Reconciled"
                        : `${formatMinutes(allocated)} / ${formatMinutes(entry.workedMinutes)}`}
                    </span>
                  </div>
                  <dl className="meta-list">
                    <dt>Primary equipment</dt>
                    <dd>
                      {entry.primaryEquipmentDisplayNameSnapshot}
                      {entry.primaryEquipmentNumberSnapshot ? ` #${entry.primaryEquipmentNumberSnapshot}` : ""}
                      <span className="subtle">
                        {entry.primaryMineNameSnapshot} · {entry.primaryCityNameSnapshot}
                        {entry.primaryCityStateSnapshot ? `, ${entry.primaryCityStateSnapshot}` : ""}
                      </span>
                    </dd>
                    <dt>Worked</dt><dd>{formatMinutes(entry.workedMinutes)}</dd>
                    <dt>Regular / Overtime</dt>
                    <dd>{formatMinutes(entry.regularMinutes)} / {formatMinutes(entry.overtimeMinutes)}</dd>
                    <dt>Work Schedule context</dt>
                    <dd>
                      {entry.workScheduleDailyAssignment
                        ? `${entry.workScheduleDailyAssignment.assignmentDate.toISOString().slice(0, 10)} · ${entry.workScheduleDailyAssignment.weeklySchedule.primaryEmployeeDisplayName}`
                        : "Not linked"}
                    </dd>
                    <dt>Notes</dt><dd>{entry.notes ?? "Not recorded"}</dd>
                  </dl>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Seq.</th><th>Work Code</th><th>Work Order</th><th>Minutes</th><th>Support Personnel</th><th>Notes</th></tr></thead>
                      <tbody>
                        {entry.allocations.map((allocation) => (
                          <tr key={allocation.id}>
                            <td>{allocation.sequence}</td>
                            <td>{allocation.workCodeSnapshot}<span className="subtle">{allocation.workCodeDescriptionSnapshot}</span></td>
                            <td>{allocation.workOrderSnapshot ?? "None"}{allocation.workOrderDescriptionSnapshot ? <span className="subtle">{allocation.workOrderDescriptionSnapshot}</span> : null}</td>
                            <td>{allocation.allocatedMinutes}</td>
                            <td>{allocation.supportPersonnel.length ? allocation.supportPersonnel.map((person) => `${person.supportPersonDisplayNameSnapshot} (${person.supportPersonTradeOrRoleSnapshot})`).join(", ") : "None"}</td>
                            <td>{allocation.notes ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {leave ? (
                <div className="timesheet-leave-entry form-stack">
                  <div className="section-heading">
                    <div><p className="eyebrow">Leave · FTO</p><h3>{formatMinutes(leave.requestedMinutes)} requested</h3></div>
                    <span className="count-pill warning">
                      {leave.approvalStatus === "REQUESTED" ? "Approval requested" : leave.approvalStatus}
                      {" · "}
                      {leave.paymentStatus === "UNVERIFIED" ? "Payment unverified" : leave.paymentStatus}
                    </span>
                  </div>
                  <p className="subtle">This record is separate from actual worked time and does not alter overtime totals.</p>
                  <dl className="meta-list">
                    <dt>Original schedule</dt>
                    <dd>
                      {leave.workScheduleDailyAssignment
                        ? `${leave.workScheduleDailyAssignment.assignmentDate.toISOString().slice(0, 10)} · ${leave.workScheduleDailyAssignment.weeklySchedule.primaryEmployeeDisplayName}`
                        : "Not linked"}
                    </dd>
                    <dt>Notes</dt><dd>{leave.notes ?? "Not recorded"}</dd>
                  </dl>
                </div>
              ) : null}
              {noWork ? <div className="timesheet-leave-entry form-stack"><div className="section-heading"><div><p className="eyebrow">No work · 0 actual hours</p><h3>{noWork.reason === "SHIFT_CANCELED" ? "Shift canceled" : "Covered by coworker"}</h3></div><span className="count-pill">Accounted for</span></div><p className="subtle">This explanation is neither worked time nor paid leave and contributes zero minutes to regular and overtime totals.</p><dl className="meta-list"><dt>Original schedule</dt><dd>{noWork.workScheduleDailyAssignment ? `${noWork.workScheduleDailyAssignment.assignmentDate.toISOString().slice(0, 10)} · ${noWork.workScheduleDailyAssignment.weeklySchedule.primaryEmployeeDisplayName}` : "Historical assignment unavailable"}</dd><dt>Notes</dt><dd>{noWork.notes ?? "Not recorded"}</dd></dl></div> : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
