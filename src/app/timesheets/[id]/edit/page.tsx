import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getTimesheetFormOptions, getWeeklyTimesheetById, timesheetToFormInput } from "@/features/timesheets/data";
import { TimesheetForm } from "@/features/timesheets/TimesheetForm";

export const dynamic = "force-dynamic";

export default async function EditTimesheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const timesheet = await getWeeklyTimesheetById(id);
  const options = timesheet ? await getTimesheetFormOptions({
    primaryEmployeeId: timesheet.primaryEmployeeId ?? undefined,
    payrollWeekStartDate: timesheet.payrollWeekStartDate.toISOString().slice(0, 10),
    existingAssignmentIds: timesheet.entries
      .map((entry) => entry.workScheduleDailyAssignmentId)
      .filter((assignmentId): assignmentId is string => Boolean(assignmentId))
      .concat(
        timesheet.leaveEntries
          .map((entry) => entry.workScheduleDailyAssignmentId)
          .filter((assignmentId): assignmentId is string => Boolean(assignmentId)),
      ),
  }) : null;
  if (!timesheet) notFound();
  if (!options) notFound();
  if (!["EXPLICIT_SELECTION", "OWNER_VERIFIED"].includes(timesheet.primaryEmployeeIdentityStatus)) redirect(`/timesheets/${id}`);
  if (timesheet.status === "COMPLETED") redirect(`/timesheets/${id}`);
  return <main className="page-stack"><section className="page-header with-actions"><div><p className="eyebrow">Timesheet</p><h1>Edit Draft</h1><p className="summary">Changes recalculate weekly regular and overtime minutes in work-date order.</p></div><Link className="button secondary" href={`/timesheets/${id}`}>Back</Link></section><TimesheetForm timesheetId={id} initial={timesheetToFormInput(timesheet)} options={options} /></main>;
}
