import Link from "next/link";
import { notFound } from "next/navigation";

import {
  dailyAssignmentStatusOptions,
  dayNames,
  optionLabel,
  weeklyScheduleStatusOptions,
} from "@/features/work-schedule/constants";
import {
  displayDateOnly,
  displayDateTime,
  displayShift,
  displayWeekRange,
  getAdjacentWeeklySchedules,
  getWeeklySchedule,
} from "@/features/work-schedule/data";

export const dynamic = "force-dynamic";

type WorkScheduleDetailPageProps = {
  params: Promise<{ id: string }>;
};

function crewSummary(
  crewMembers: {
    phase: string;
    role: string;
    displayName: string | null;
    isUnknown: boolean;
  }[],
  phase: "PLANNED" | "ACTUAL",
) {
  const members = crewMembers.filter((member) => member.phase === phase);

  if (members.length === 0) {
    return "Not recorded";
  }

  return members
    .map((member) => {
      const role = member.role === "PRIMARY_EMPLOYEE" ? "Primary" : "Partner";
      const name = member.isUnknown ? "Unknown" : (member.displayName ?? "Not recorded");
      return `${role}: ${name}`;
    })
    .join("; ");
}

function equipmentSummary(
  name: string | null,
  number: string | null,
  mine: string | null,
  city: string | null,
) {
  if (!name) {
    return "Not selected";
  }

  return `${name}${number ? ` #${number}` : ""}${mine ? ` - ${mine}` : ""}${city ? `, ${city}` : ""}`;
}

export default async function WorkScheduleDetailPage({
  params,
}: WorkScheduleDetailPageProps) {
  const { id } = await params;
  const schedule = await getWeeklySchedule(id);

  if (!schedule) {
    notFound();
  }

  const { previousSchedule, nextSchedule } = await getAdjacentWeeklySchedules(
    schedule.weekStartDate,
    schedule.primaryEmployeeKey,
  );

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Planning</p>
          <h1 id="page-title">
            {displayWeekRange(schedule.weekStartDate, schedule.weekEndDate)}
          </h1>
          <p className="summary">
            Weekly assignments for {schedule.primaryEmployeeDisplayName}.
          </p>
        </div>
        <div className="button-row">
          <Link className="button secondary" href="/work-schedule">
            Back
          </Link>
          {previousSchedule ? (
            <Link className="button secondary" href={`/work-schedule/${previousSchedule.id}`}>
              Previous Week
            </Link>
          ) : null}
          {nextSchedule ? (
            <Link className="button secondary" href={`/work-schedule/${nextSchedule.id}`}>
              Next Week
            </Link>
          ) : null}
          <Link className="button primary" href={`/work-schedule/${schedule.id}/edit`}>
            Edit
          </Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="schedule-summary-heading">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2 id="schedule-summary-heading">Summary</h2>
          <dl className="meta-list">
            <dt>Status</dt>
            <dd>{optionLabel(weeklyScheduleStatusOptions, schedule.status)}</dd>
            <dt>Assigned By</dt>
            <dd>{schedule.assignedByDisplayName}</dd>
            <dt>Received</dt>
            <dd>{displayDateTime(schedule.receivedAt)}</dd>
            <dt>Source note</dt>
            <dd>{schedule.sourceNote ?? "Not recorded"}</dd>
            <dt>Schedule notes</dt>
            <dd>{schedule.scheduleNotes ?? "Not recorded"}</dd>
          </dl>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="assignments-heading">
        <div className="section-heading">
          <h2 id="assignments-heading">Daily assignments</h2>
          <span className="count-pill">{schedule.assignments.length}</span>
        </div>

        <div className="record-list">
          {schedule.assignments.map((assignment) => (
            <article className="record-card" key={assignment.id}>
              <div>
                <h3>{dayNames[assignment.dayOfWeek - 1]} - {displayDateOnly(assignment.assignmentDate)}</h3>
                <dl className="meta-list">
                  <dt>Planned</dt>
                  <dd>
                    {optionLabel(dailyAssignmentStatusOptions, assignment.plannedStatus)} / {displayShift(assignment.plannedShift)}
                    <span className="subtle">
                      {equipmentSummary(
                        assignment.plannedEquipmentDisplayName,
                        assignment.plannedEquipmentNumber,
                        assignment.plannedMineName,
                        assignment.plannedCityName,
                      )}
                    </span>
                  </dd>
                  <dt>Actual</dt>
                  <dd>
                    {optionLabel(dailyAssignmentStatusOptions, assignment.actualStatus)} / {displayShift(assignment.actualShift)}
                    <span className="subtle">
                      {equipmentSummary(
                        assignment.actualEquipmentDisplayName,
                        assignment.actualEquipmentNumber,
                        assignment.actualMineName,
                        assignment.actualCityName,
                      )}
                    </span>
                  </dd>
                  <dt>Planned crew</dt>
                  <dd>{crewSummary(assignment.crewMembers, "PLANNED")}</dd>
                  <dt>Actual crew</dt>
                  <dd>{crewSummary(assignment.crewMembers, "ACTUAL")}</dd>
                  <dt>Change reason</dt>
                  <dd>{assignment.changeReason ?? "Not recorded"}</dd>
                </dl>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
