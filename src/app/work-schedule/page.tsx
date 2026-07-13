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

export default async function WorkSchedulePage() {
  const schedules = await getWeeklySchedules();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">Work Schedule</h1>
          <p className="summary">
            Enter weekly equipment assignments, planned crew, and actual work outcomes.
          </p>
        </div>
        <Link className="button primary" href="/work-schedule/new">
          New Weekly Schedule
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="work-schedule-list-heading">
        <div className="section-heading">
          <h2 id="work-schedule-list-heading">Weekly schedules</h2>
          <span className="count-pill">{schedules.length}</span>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Schedules yet</h3>
            <p>Create a weekly schedule to preserve planned and actual assignments.</p>
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

