import Link from "next/link";

import { dailyLogActivityTypeOptions, optionLabel, shiftOptions } from "@/features/daily-logs/constants";
import { displayDateOnly, getDailyLogsForDate } from "@/features/daily-logs/data";
import { dailyLogFilterHref } from "@/features/daily-logs/filters";
import {
  dayViewHref,
  parseDayViewDate,
  type DayViewSearchParams,
} from "@/features/day-view/date";

export const dynamic = "force-dynamic";

type DayViewPageProps = {
  searchParams?: Promise<DayViewSearchParams>;
};

const placeholderModules = [
  {
    title: "STOP Cards",
    description: "STOP Card records are not implemented yet.",
  },
  {
    title: "Daily Inspections",
    description: "Daily Inspection records are not implemented yet.",
  },
  {
    title: "Work Authorizations",
    description: "Work Authorization records are not implemented yet.",
  },
];

function displaySelectedDate(value: string) {
  return displayDateOnly(new Date(`${value}T00:00:00.000Z`));
}

export default async function DayViewPage({ searchParams }: DayViewPageProps) {
  const dateState = parseDayViewDate((await searchParams) ?? {});
  const dailyLogs = await getDailyLogsForDate(dateState.selectedDate);

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
