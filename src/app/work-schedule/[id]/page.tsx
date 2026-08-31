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

type CrewMember = {
  phase: string;
  role: string;
  employeeId?: string | null;
  displayName: string | null;
  isUnknown: boolean;
};

function meaningfulText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function crewSummary(
  crewMembers: CrewMember[],
  phase: "PLANNED" | "ACTUAL",
) {
  const members = crewMembers.filter((member) => member.phase === phase);
  const primary = members.find((member) => member.role === "PRIMARY_EMPLOYEE");
  const partner = members.find((member) => member.role === "PARTNER");
  const primaryName = primary?.isUnknown
    ? "Unknown"
    : meaningfulText(primary?.displayName);
  const partnerName = partner?.isUnknown
    ? "Unknown partner"
    : meaningfulText(partner?.displayName);

  return [primaryName, partnerName].filter(Boolean).join(" & ") || null;
}

function crewsMatch(crewMembers: CrewMember[]) {
  return ["PRIMARY_EMPLOYEE", "PARTNER"].every((role) => {
    const planned = crewMembers.find(
      (member) => member.phase === "PLANNED" && member.role === role,
    );
    const actual = crewMembers.find(
      (member) => member.phase === "ACTUAL" && member.role === role,
    );

    if (!planned || !actual) {
      return planned === actual;
    }

    if (planned.isUnknown || actual.isUnknown) {
      return planned.isUnknown === actual.isUnknown;
    }

    if (planned.employeeId && actual.employeeId) {
      return planned.employeeId === actual.employeeId;
    }

    return meaningfulText(planned.displayName)?.toLowerCase() ===
      meaningfulText(actual.displayName)?.toLowerCase();
  });
}

function equipmentSummary(
  name: string | null,
  number: string | null,
  mine: string | null,
  city: string | null,
) {
  const displayName = meaningfulText(name);

  if (!displayName) {
    return null;
  }

  const identity = `${displayName}${meaningfulText(number) ? ` #${number?.trim()}` : ""}`;
  const location = [meaningfulText(mine), meaningfulText(city)].filter(Boolean).join(", ");

  return location ? `${identity} — ${location}` : identity;
}

function equipmentMatches(
  plannedId: string | null,
  actualId: string | null,
  plannedSnapshots: (string | null)[],
  actualSnapshots: (string | null)[],
) {
  if (plannedId && actualId) {
    return plannedId === actualId;
  }

  return plannedSnapshots.every(
    (value, index) => meaningfulText(value)?.toLowerCase() ===
      meaningfulText(actualSnapshots[index])?.toLowerCase(),
  );
}

function assignmentsMatch(assignment: {
  plannedStatus: string;
  plannedShift: string;
  plannedEquipmentId: string | null;
  plannedEquipmentDisplayName: string | null;
  plannedEquipmentNumber: string | null;
  plannedMineName: string | null;
  plannedCityName: string | null;
  actualStatus: string;
  actualShift: string;
  actualEquipmentId: string | null;
  actualEquipmentDisplayName: string | null;
  actualEquipmentNumber: string | null;
  actualMineName: string | null;
  actualCityName: string | null;
}) {
  return assignment.plannedStatus === assignment.actualStatus &&
    assignment.plannedShift === assignment.actualShift &&
    equipmentMatches(
      assignment.plannedEquipmentId,
      assignment.actualEquipmentId,
      [
      assignment.plannedEquipmentDisplayName,
      assignment.plannedEquipmentNumber,
      assignment.plannedMineName,
      assignment.plannedCityName,
      ],
      [
        assignment.actualEquipmentDisplayName,
        assignment.actualEquipmentNumber,
        assignment.actualMineName,
        assignment.actualCityName,
      ],
    );
}

function hasActualAssignment(assignment: {
  actualStatus: string;
  actualShift: string;
  actualEquipmentId: string | null;
  actualEquipmentDisplayName: string | null;
}) {
  return assignment.actualStatus !== "UNKNOWN" ||
    assignment.actualShift !== "UNKNOWN" ||
    Boolean(assignment.actualEquipmentId) ||
    Boolean(meaningfulText(assignment.actualEquipmentDisplayName));
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
            {meaningfulText(schedule.sourceNote) ? (
              <>
                <dt>Source note</dt>
                <dd>{meaningfulText(schedule.sourceNote)}</dd>
              </>
            ) : null}
            {meaningfulText(schedule.scheduleNotes) ? (
              <>
                <dt>Schedule notes</dt>
                <dd>{meaningfulText(schedule.scheduleNotes)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="assignments-heading">
        <div className="section-heading">
          <h2 id="assignments-heading">Daily assignments</h2>
          <span className="count-pill">{schedule.assignments.length}</span>
        </div>

        <div className="record-list">
          {schedule.assignments.map((assignment) => {
            const plannedEquipment = equipmentSummary(
              assignment.plannedEquipmentDisplayName,
              assignment.plannedEquipmentNumber,
              assignment.plannedMineName,
              assignment.plannedCityName,
            );
            const actualEquipment = equipmentSummary(
              assignment.actualEquipmentDisplayName,
              assignment.actualEquipmentNumber,
              assignment.actualMineName,
              assignment.actualCityName,
            );
            const plannedCrew = crewSummary(assignment.crewMembers, "PLANNED");
            const actualCrew = crewSummary(assignment.crewMembers, "ACTUAL");
            const actualAssignmentRecorded = hasActualAssignment(assignment);
            const matchingAssignments = actualAssignmentRecorded && assignmentsMatch(assignment);
            const matchingCrews = plannedCrew && actualCrew && crewsMatch(assignment.crewMembers);
            const changeReason = meaningfulText(assignment.changeReason);

            const assignmentDetails = (
              phase: "planned" | "actual",
              equipment: string | null,
            ) => (
              <dd>
                {optionLabel(
                  dailyAssignmentStatusOptions,
                  phase === "planned" ? assignment.plannedStatus : assignment.actualStatus,
                )} / {displayShift(
                  phase === "planned" ? assignment.plannedShift : assignment.actualShift,
                )}
                {equipment ? <span className="subtle">{equipment}</span> : null}
              </dd>
            );

            return (
              <article className="record-card" key={assignment.id}>
                <div>
                  <h3>{dayNames[assignment.dayOfWeek - 1]} — {displayDateOnly(assignment.assignmentDate)}</h3>
                  <dl className="meta-list">
                    <dt>{matchingAssignments || !actualAssignmentRecorded ? "Assignment" : "Planned"}</dt>
                    {assignmentDetails("planned", plannedEquipment)}
                    {actualAssignmentRecorded && !matchingAssignments ? (
                      <>
                        <dt>Actual</dt>
                        {assignmentDetails("actual", actualEquipment)}
                      </>
                    ) : null}
                    {plannedCrew && matchingCrews ? (
                      <>
                        <dt>Crew</dt>
                        <dd>{plannedCrew}</dd>
                      </>
                    ) : (
                      <>
                        {plannedCrew ? (
                          <>
                            <dt>{actualCrew ? "Planned crew" : "Crew"}</dt>
                            <dd>{plannedCrew}</dd>
                          </>
                        ) : null}
                        {actualCrew ? (
                          <>
                            <dt>{plannedCrew ? "Actual crew" : "Crew"}</dt>
                            <dd>{actualCrew}</dd>
                          </>
                        ) : null}
                      </>
                    )}
                    {changeReason ? (
                      <>
                        <dt>Change reason</dt>
                        <dd>{changeReason}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
