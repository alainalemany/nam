import Link from "next/link";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  optionLabel as dailyInspectionOptionLabel,
  shiftOptions as dailyInspectionShiftOptions,
} from "@/features/daily-inspections/constants";
import { getDailyInspectionsForDate } from "@/features/daily-inspections/data";
import {
  defectPriorityOptions,
  defectSeverityOptions,
  defectStatusOptions,
  optionLabel as defectOptionLabel,
} from "@/features/defect-tracking/constants";
import { getDefectsForDate } from "@/features/defect-tracking/data";
import { dailyLogActivityTypeOptions, optionLabel, shiftOptions } from "@/features/daily-logs/constants";
import { displayDateOnly, getDailyLogsForDate } from "@/features/daily-logs/data";
import { dailyLogFilterHref } from "@/features/daily-logs/filters";
import {
  dayViewHref,
  parseDayViewDate,
  type DayViewSearchParams,
} from "@/features/day-view/date";
import {
  optionLabel as shiftReportOptionLabel,
  shiftOptions as shiftReportShiftOptions,
  shiftReportStatusOptions,
} from "@/features/shift-reports/constants";
import { getShiftReportsForDate } from "@/features/shift-reports/data";
import {
  optionLabel as stopCardOptionLabel,
  stopCardCategoryOptions,
  stopCardSeverityOptions,
  stopCardStatusOptions,
} from "@/features/stop-cards/constants";
import { getStopCardsForDate } from "@/features/stop-cards/data";
import { stopCardFilterHref } from "@/features/stop-cards/filters";
import { getTimesheetContextsForDate } from "@/features/timesheets/data";
import {
  optionLabel as workAuthorizationOptionLabel,
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "@/features/work-authorizations/constants";
import { getWorkAuthorizationsForDate } from "@/features/work-authorizations/data";
import { getWorkScheduleContextsForDate } from "@/features/work-schedule/data";

export const dynamic = "force-dynamic";

type DayViewPageProps = {
  searchParams?: Promise<DayViewSearchParams>;
};

function displaySelectedDate(value: string) {
  return displayDateOnly(new Date(`${value}T00:00:00.000Z`));
}

export default async function DayViewPage({ searchParams }: DayViewPageProps) {
  const dateState = parseDayViewDate((await searchParams) ?? {});
  const [
    workSchedules,
    timesheets,
    dailyLogs,
    stopCards,
    dailyInspections,
    shiftReports,
    workAuthorizations,
    defects,
  ] = await Promise.all([
    getWorkScheduleContextsForDate(dateState.selectedDate),
    getTimesheetContextsForDate(dateState.selectedDate),
    getDailyLogsForDate(dateState.selectedDate),
    getStopCardsForDate(dateState.selectedDate),
    getDailyInspectionsForDate(dateState.selectedDate),
    getShiftReportsForDate(dateState.selectedDate),
    getWorkAuthorizationsForDate(dateState.selectedDate),
    getDefectsForDate(dateState.selectedDate),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Day View</h1>
          <p className="summary">
            Workday context for {displaySelectedDate(dateState.selectedDate)}.
          </p>
        </div>
        <Link className="button primary" href="/daily-logs/new">
          New Daily Log
        </Link>
      </section>

      <section className="panel date-navigation-panel" aria-labelledby="day-view-date-heading">
        <div>
          <p className="eyebrow">Selected workday</p>
          <h2 id="day-view-date-heading">{displaySelectedDate(dateState.selectedDate)}</h2>
          <p className="summary">{dateState.selectedDate}</p>
        </div>
        <div className="date-navigation-actions">
          <Link className="button secondary" href={dayViewHref(dateState.previousDate)}>
            Previous Day
          </Link>
          <Link className="button secondary" href={dayViewHref(dateState.today)}>
            Today
          </Link>
          <Link className="button secondary" href={dayViewHref(dateState.nextDate)}>
            Next Day
          </Link>
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="work-schedule-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planning context</p>
            <h2 id="work-schedule-heading">Work Schedule</h2>
          </div>
          <span className="count-pill">{workSchedules.length}</span>
        </div>

        {workSchedules.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Schedule for this day</h3>
            <p>
              Work Schedule is implemented, but no schedule assignment matches
              the selected workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/work-schedule/new">
                Add Work Schedule
              </Link>
              <Link className="button secondary" href="/work-schedule">
                Open Work Schedule
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {workSchedules.map((schedule) => (
              <article className="record-card" key={`${schedule.scheduleId}-${schedule.assignmentDate}`}>
                <div>
                  <p className="eyebrow">
                    {schedule.outcome}
                    {" · "}
                    {schedule.weeklyStatus}
                    {" · "}
                    {schedule.assignmentStatus}
                  </p>
                  <h3>{schedule.primaryEmployeeDisplayName}</h3>
                  <p className="subtle">Assigned By: {schedule.assignedByDisplayName}</p>
                  <dl className="meta-list">
                    <dt>Planned</dt>
                    <dd>
                      {schedule.planned.status} / {schedule.planned.shift}
                      <span className="subtle">{schedule.planned.equipment}</span>
                      <span className="subtle">Partner: {schedule.planned.partner.label}</span>
                      {schedule.planned.notes ? (
                        <span className="subtle">Note: {schedule.planned.notes}</span>
                      ) : null}
                    </dd>
                    <dt>Actual</dt>
                    <dd>
                      {schedule.actual.status} / {schedule.actual.shift}
                      <span className="subtle">{schedule.actual.equipment}</span>
                      <span className="subtle">Partner: {schedule.actual.partner.label}</span>
                      {schedule.actual.notes ? (
                        <span className="subtle">Note: {schedule.actual.notes}</span>
                      ) : null}
                    </dd>
                    {schedule.explanation ? (
                      <>
                        <dt>Explanation</dt>
                        <dd>{schedule.explanation}</dd>
                      </>
                    ) : null}
                  </dl>
                </div>
                <Link className="table-action" href={schedule.detailHref}>
                  View Weekly Schedule
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="timesheet-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Worked-time context</p>
            <h2 id="timesheet-heading">Timesheet</h2>
          </div>
          <span className="count-pill">{timesheets.length}</span>
        </div>

        {timesheets.length === 0 ? (
          <div className="empty-state">
            <h3>No Timesheet entry for this day</h3>
            <p>No Daily Time Entry matches the selected workday.</p>
            <div className="button-row">
              <Link className="button primary" href="/timesheets/new">
                Add Timesheet Entry
              </Link>
              <Link className="button secondary" href="/timesheets">
                Open Timesheets
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {timesheets.map((timesheet) => (
              <article className="record-card" key={`${timesheet.timesheetId}-${timesheet.workDate}`}>
                <div>
                  <p className="eyebrow">
                    {timesheet.status}
                    {" · "}
                    {timesheet.allocationStatus}
                  </p>
                  <h3>{timesheet.primaryEmployeeDisplayName}</h3>
                  <p className="subtle">
                    {timesheet.workDate}
                    {" · "}
                    {timesheet.clockIn}–{timesheet.clockOut}
                    {" · Break "}
                    {timesheet.breakTime}
                  </p>
                  <p className="subtle">Equipment: {timesheet.equipment}</p>
                  <dl className="meta-list">
                    <dt>Worked</dt>
                    <dd>{timesheet.workedTime}</dd>
                    <dt>Regular</dt>
                    <dd>{timesheet.regularTime}</dd>
                    <dt>Overtime</dt>
                    <dd>{timesheet.overtimeTime}</dd>
                    <dt>Allocated</dt>
                    <dd>
                      {timesheet.allocatedTime}
                      <span className="subtle">{timesheet.allocationStatusLabel}</span>
                    </dd>
                  </dl>
                  {timesheet.allocations.length > 0 ? (
                    <ol className="compact-list">
                      {timesheet.allocations.map((allocation) => (
                        <li key={`${timesheet.timesheetId}-${timesheet.workDate}-${allocation.sequence}`}>
                          <strong>{allocation.workCode}</strong>
                          {" · "}
                          {allocation.allocatedTime}
                          {allocation.workOrder ? (
                            <span className="subtle">Work Order: {allocation.workOrder}</span>
                          ) : null}
                          {allocation.supportPersonnel.length > 0 ? (
                            <span className="subtle">
                              Support: {allocation.supportPersonnel.join(", ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
                <Link className="table-action" href={timesheet.detailHref}>
                  View Weekly Timesheet
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="daily-logs-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Narrative</p>
            <h2 id="daily-logs-heading">Daily Logs</h2>
          </div>
          <span className="count-pill">{dailyLogs.length}</span>
        </div>

        {dailyLogs.length === 0 ? (
          <div className="empty-state">
            <h3>No Daily Logs for this date</h3>
            <p>
              Daily Work Logs are implemented, but no records match the selected
              workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/daily-logs/new">
                Add Daily Log
              </Link>
              <Link
                className="button secondary"
                href={dailyLogFilterHref(
                  {},
                  {
                    dateFrom: dateState.selectedDate,
                    dateTo: dateState.selectedDate,
                  },
                )}
              >
                Open Daily Logs
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {dailyLogs.map((dailyLog) => (
              <article className="record-card" key={dailyLog.id}>
                <div>
                  <p className="eyebrow">{optionLabel(shiftOptions, dailyLog.shift)}</p>
                  <h3>{dailyLog.summary}</h3>
                  <p className="subtle">
                    {dailyLog.mine
                      ? `${dailyLog.mine.name}, ${dailyLog.mine.city.name}`
                      : "Mine not set"}
                    {" · "}
                    {dailyLog.primaryEquipment?.displayName ?? "Equipment not set"}
                  </p>
                  <p className="subtle">
                    First activity:{" "}
                    {dailyLog.activities[0]
                      ? optionLabel(
                          dailyLogActivityTypeOptions,
                          dailyLog.activities[0].activityType,
                        )
                      : "None"}
                  </p>
                </div>
                <Link className="table-action" href={`/daily-logs/${dailyLog.id}`}>
                  View Daily Log
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="stop-cards-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Safety</p>
            <h2 id="stop-cards-heading">STOP Cards</h2>
          </div>
          <span className="count-pill">{stopCards.length}</span>
        </div>

        {stopCards.length === 0 ? (
          <div className="empty-state">
            <h3>No STOP Cards for this day</h3>
            <p>
              STOP Cards are implemented, but no safety observations match the
              selected workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/stop-cards/new">
                Add STOP Card
              </Link>
              <Link
                className="button secondary"
                href={stopCardFilterHref(
                  {},
                  {
                    dateFrom: dateState.selectedDate,
                    dateTo: dateState.selectedDate,
                  },
                )}
              >
                Open STOP Cards
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {stopCards.map((stopCard) => (
              <article className="record-card" key={stopCard.id}>
                <div>
                  <p className="eyebrow">
                    {stopCardOptionLabel(stopCardStatusOptions, stopCard.status)}
                    {" · "}
                    {stopCardOptionLabel(stopCardSeverityOptions, stopCard.severity)}
                  </p>
                  <h3>{stopCardOptionLabel(stopCardCategoryOptions, stopCard.category)}</h3>
                  <p>{stopCard.description}</p>
                  <p className="subtle">
                    {stopCard.mine
                      ? `${stopCard.mine.name}, ${stopCard.mine.city.name}`
                      : "Mine not set"}
                    {" · "}
                    {stopCard.location ??
                      stopCard.equipment?.displayName ??
                      "Location not set"}
                  </p>
                </div>
                <Link className="table-action" href={`/stop-cards/${stopCard.id}`}>
                  View STOP Card
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="daily-inspections-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inspection</p>
            <h2 id="daily-inspections-heading">Daily Inspections</h2>
          </div>
          <span className="count-pill">{dailyInspections.length}</span>
        </div>

        {dailyInspections.length === 0 ? (
          <div className="empty-state">
            <h3>No Daily Inspections for this day</h3>
            <p>
              Daily Inspections are implemented, but no inspection records match
              the selected workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/daily-inspections/new">
                Add Daily Inspection
              </Link>
              <Link className="button secondary" href="/daily-inspections">
                Open Daily Inspections
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {dailyInspections.map((inspection) => (
              <article className="record-card" key={inspection.id}>
                <div>
                  <p className="eyebrow">
                    {dailyInspectionOptionLabel(
                      dailyInspectionShiftOptions,
                      inspection.shift,
                    )}
                    {" · "}
                    {dailyInspectionOptionLabel(
                      dailyInspectionStatusOptions,
                      inspection.status,
                    )}
                  </p>
                  <h3>
                    {inspection.equipment?.displayName ?? "Equipment not set"}
                  </h3>
                  <p>{inspection.findings}</p>
                  <p className="subtle">
                    {dailyInspectionOptionLabel(
                      dailyInspectionConditionOptions,
                      inspection.condition,
                    )}
                    {" · "}
                    {inspection.mine
                      ? `${inspection.mine.name}, ${inspection.mine.city.name}`
                      : "Mine not set"}
                    {" · "}
                    Defects: {inspection.defectsIdentified ? "Yes" : "No"}
                  </p>
                </div>
                <Link
                  className="table-action"
                  href={`/daily-inspections/${inspection.id}`}
                >
                  View Daily Inspection
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="shift-reports-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operations summary</p>
            <h2 id="shift-reports-heading">Shift Reports</h2>
          </div>
          <span className="count-pill">{shiftReports.length}</span>
        </div>

        {shiftReports.length === 0 ? (
          <div className="empty-state">
            <h3>No Shift Reports for this day</h3>
            <p>
              Shift Reports are implemented, but no coordination records match
              the selected workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/shift-reports/new">
                Add Shift Report
              </Link>
              <Link className="button secondary" href="/shift-reports">
                Open Shift Reports
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {shiftReports.map((report) => (
              <article className="record-card" key={report.id}>
                <div>
                  <p className="eyebrow">
                    {shiftReportOptionLabel(shiftReportShiftOptions, report.shift)}
                    {" · "}
                    {shiftReportOptionLabel(shiftReportStatusOptions, report.status)}
                  </p>
                  <h3>{report.summary}</h3>
                  <p className="subtle">
                    {report.mine
                      ? `${report.mine.name}, ${report.mine.city.name}`
                      : "Mine not set"}
                    {" · "}
                    {report.equipment?.displayName ?? report.location ?? "Location not set"}
                  </p>
                </div>
                <Link className="table-action" href={`/shift-reports/${report.id}`}>
                  View Shift Report
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="work-authorizations-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Authorized work</p>
            <h2 id="work-authorizations-heading">Work Authorizations</h2>
          </div>
          <span className="count-pill">{workAuthorizations.length}</span>
        </div>

        {workAuthorizations.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Authorizations for this day</h3>
            <p>
              Work Authorizations are implemented, but no authorization records
              are linked to Shift Reports for the selected workday.
            </p>
            <div className="button-row">
              <Link className="button primary" href="/work-authorizations/new">
                Add Work Authorization
              </Link>
              <Link className="button secondary" href="/work-authorizations">
                Open Work Authorizations
              </Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {workAuthorizations.map((authorization) => (
              <article className="record-card" key={authorization.id}>
                <div>
                  <p className="eyebrow">
                    {workAuthorizationOptionLabel(
                      workAuthorizationStatusOptions,
                      authorization.status,
                    )}
                    {" · "}
                    {workAuthorizationOptionLabel(
                      workAuthorizationWorkTypeOptions,
                      authorization.workType,
                    )}
                  </p>
                  <h3>{authorization.workDescription}</h3>
                  <p className="subtle">
                    Shift Report:{" "}
                    <Link
                      className="table-action"
                      href={`/shift-reports/${authorization.shiftReportId}`}
                    >
                      {shiftReportOptionLabel(
                        shiftReportShiftOptions,
                        authorization.shiftReport.shift,
                      )}
                    </Link>
                    {" · "}
                    {authorization.mine
                      ? `${authorization.mine.name}, ${authorization.mine.city.name}`
                      : "Mine not set"}
                    {" · "}
                    {authorization.equipment?.displayName ??
                      authorization.jobLocation ??
                      "Location not set"}
                  </p>
                  <p className="subtle">
                    Crew: {authorization.crewWorkerCount ?? "Not recorded"}
                    {" · "}
                    Lockout required: {authorization.lockoutRequired ? "Yes" : "No"}
                  </p>
                </div>
                <Link
                  className="table-action"
                  href={`/work-authorizations/${authorization.id}`}
                >
                  View Work Authorization
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel table-panel" aria-labelledby="defects-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Equipment issues</p>
            <h2 id="defects-heading">Defects</h2>
          </div>
          <span className="count-pill">{defects.length}</span>
        </div>

        {defects.length === 0 ? (
          <div className="empty-state">
            <h3>No Defects for this day</h3>
            <p>Defect Tracking is implemented, but no defects were reported for the selected workday.</p>
            <div className="button-row">
              <Link className="button primary" href="/defect-tracking/new">Add Defect</Link>
              <Link className="button secondary" href="/defect-tracking">Open Defect Tracking</Link>
            </div>
          </div>
        ) : (
          <div className="record-list">
            {defects.map((defect) => (
              <article className="record-card" key={defect.id}>
                <div>
                  <p className="eyebrow">
                    {defectOptionLabel(defectStatusOptions, defect.status)}
                    {" · "}
                    {defectOptionLabel(defectSeverityOptions, defect.severity)}
                    {" · "}
                    {defectOptionLabel(defectPriorityOptions, defect.priority)} priority
                  </p>
                  <h3>{defect.title}</h3>
                  <p>{defect.description}</p>
                  <p className="subtle">{defect.equipment.displayName} · {defect.equipment.mine.name}</p>
                </div>
                <Link className="table-action" href={`/defect-tracking/${defect.id}`}>View Defect</Link>
              </article>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
