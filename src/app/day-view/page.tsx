import Link from "next/link";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  optionLabel as dailyInspectionOptionLabel,
  shiftOptions as dailyInspectionShiftOptions,
} from "@/features/daily-inspections/constants";
import { getDailyInspectionsForDate } from "@/features/daily-inspections/data";
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

export const dynamic = "force-dynamic";

type DayViewPageProps = {
  searchParams?: Promise<DayViewSearchParams>;
};

const placeholderModules = [
  {
    title: "Work Authorizations",
    description: "Work Authorization Day View participation is not implemented yet.",
  },
];

function displaySelectedDate(value: string) {
  return displayDateOnly(new Date(`${value}T00:00:00.000Z`));
}

export default async function DayViewPage({ searchParams }: DayViewPageProps) {
  const dateState = parseDayViewDate((await searchParams) ?? {});
  const [dailyLogs, stopCards, dailyInspections, shiftReports] = await Promise.all([
    getDailyLogsForDate(dateState.selectedDate),
    getStopCardsForDate(dateState.selectedDate),
    getDailyInspectionsForDate(dateState.selectedDate),
    getShiftReportsForDate(dateState.selectedDate),
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

      <section className="module-grid" aria-label="Planned modules">
        {placeholderModules.map((module) => (
          <article className="panel placeholder-panel" key={module.title}>
            <div>
              <p className="eyebrow">Module not implemented</p>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
