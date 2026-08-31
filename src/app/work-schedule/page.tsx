import Link from "next/link";

import {
  dailyAssignmentStatusOptions,
  optionLabel,
  weeklyScheduleStatusOptions,
} from "@/features/work-schedule/constants";
import {
  displayDateOnly,
  displayDateTime,
  displayWeekRange,
  getWeeklySchedules,
} from "@/features/work-schedule/data";

export const dynamic = "force-dynamic";

type WorkSchedulePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkSchedulePage({ searchParams }: WorkSchedulePageProps) {
  const schedules = await getWeeklySchedules();
  const params = await searchParams;
  const saved = params?.saved === "range";
  const startDate = typeof params?.startDate === "string" ? params.startDate : undefined;
  const endDate = typeof params?.endDate === "string" ? params.endDate : undefined;
  const weeks = typeof params?.weeks === "string" ? params.weeks : undefined;

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">Work Schedule</h1>
          <p className="summary">
            Create schedules across continuous date ranges, then browse the canonical calendar weeks.
          </p>
        </div>
        <Link className="button primary" href="/work-schedule/new">
          New Schedule
        </Link>
      </section>

      {saved ? (
        <div className="success-confirmation" role="status">
          <strong>Schedule saved successfully.</strong>
          {startDate && endDate ? <p>{startDate} through {endDate}{weeks ? ` across ${weeks} calendar ${weeks === "1" ? "week" : "weeks"}` : ""}.</p> : null}
        </div>
      ) : null}

      <section className="panel table-panel" aria-labelledby="work-schedule-list-heading">
        <div className="section-heading">
          <h2 id="work-schedule-list-heading">Weekly schedules</h2>
          <span className="count-pill">{schedules.length}</span>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Schedules yet</h3>
            <p>Create a schedule range to preserve planned and actual assignments.</p>
            <Link className="button primary" href="/work-schedule/new">
              Add Work Schedule
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Primary employee</th>
                  <th>Assigned By</th>
                  <th>Status</th>
                  <th>Assignments</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>{displayWeekRange(schedule.weekStartDate, schedule.weekEndDate)}</td>
                    <td>{schedule.primaryEmployeeDisplayName}</td>
                    <td>{schedule.assignedByDisplayName}</td>
                    <td>{optionLabel(weeklyScheduleStatusOptions, schedule.status)}</td>
                    <td>
                      {schedule._count.assignments}
                      <span className="subtle">
                        {optionLabel(dailyAssignmentStatusOptions, "SCHEDULED")} and non-working days
                      </span>
                    </td>
                    <td>
                      {displayDateOnly(schedule.updatedAt)}
                      <span className="subtle">{displayDateTime(schedule.receivedAt)}</span>
                    </td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/work-schedule/${schedule.id}`}>
                        View
                      </Link>
                      <Link className="table-action" href={`/work-schedule/${schedule.id}/edit`}>
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
