import Link from "next/link";

import { dailyLogActivityTypeOptions, optionLabel, shiftOptions } from "@/features/daily-logs/constants";
import { displayDateOnly, getDailyLogFormOptions, getDailyLogs } from "@/features/daily-logs/data";
import {
  dailyLogFilterHref,
  hasDailyLogFilters,
  parseDailyLogFilters,
  selectedDailyLogDate,
  shiftDailyLogDate,
  todayDateValue,
  type DailyLogSearchParams,
} from "@/features/daily-logs/filters";

export const dynamic = "force-dynamic";

type DailyLogsPageProps = {
  searchParams?: Promise<DailyLogSearchParams>;
};

export default async function DailyLogsPage({ searchParams }: DailyLogsPageProps) {
  const filters = parseDailyLogFilters((await searchParams) ?? {});
  const filtersActive = hasDailyLogFilters(filters);
  const today = todayDateValue();
  const selectedDate = selectedDailyLogDate(filters, today);
  const previousDate = shiftDailyLogDate(selectedDate, -1);
  const nextDate = shiftDailyLogDate(selectedDate, 1);
  const [dailyLogs, options] = await Promise.all([
    getDailyLogs(filters),
    getDailyLogFormOptions(),
  ]);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Daily Logs</h1>
          <p className="summary">
            Workday narratives with activity timelines, equipment context, and
            mine associations.
          </p>
        </div>
        <Link className="button primary" href="/daily-logs/new">
          New Daily Log
        </Link>
      </section>

      <section className="panel date-navigation-panel" aria-labelledby="daily-log-date-heading">
        <div>
          <p className="eyebrow">Date navigation</p>
          <h2 id="daily-log-date-heading">{selectedDate}</h2>
          <p className="summary">
            Jump by day while keeping the other Daily Log filters active.
          </p>
        </div>
        <div className="date-navigation-actions">
          <Link
            className="button secondary"
            href={dailyLogFilterHref(filters, {
              dateFrom: previousDate,
              dateTo: previousDate,
            })}
          >
            Previous Day
          </Link>
          <Link
            className="button secondary"
            href={dailyLogFilterHref(filters, {
              dateFrom: today,
              dateTo: today,
            })}
          >
            Today
          </Link>
          <Link
            className="button secondary"
            href={dailyLogFilterHref(filters, {
              dateFrom: nextDate,
              dateTo: nextDate,
            })}
          >
            Next Day
          </Link>
        </div>
      </section>

      <section className="panel filter-panel" aria-labelledby="daily-log-filters-heading">
        <form action="/daily-logs" className="form-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Search</p>
              <h2 id="daily-log-filters-heading">Find Daily Logs</h2>
            </div>
            {filtersActive ? (
              <Link className="button secondary" href="/daily-logs">
                Clear Filters
              </Link>
            ) : null}
          </div>

          <div className="form-grid">
            <label>
              <span>Text</span>
              <input
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Summary, notes, company, person, equipment"
                autoComplete="off"
              />
            </label>

            <label>
              <span>Shift</span>
              <select name="shift" defaultValue={filters.shift ?? ""}>
                <option value="">Any shift</option>
                {shiftOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>From date</span>
              <input name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
            </label>

            <label>
              <span>To date</span>
              <input name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
            </label>

            <label>
              <span>Mine</span>
              <select name="mineId" defaultValue={filters.mineId ?? ""}>
                <option value="">Any mine</option>
                {options.mineOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Equipment</span>
              <select name="equipmentId" defaultValue={filters.equipmentId ?? ""}>
                <option value="">Any equipment</option>
                {options.equipmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Activity type</span>
              <select name="activityType" defaultValue={filters.activityType ?? ""}>
                <option value="">Any activity type</option>
                {dailyLogActivityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-actions">
            <button className="button primary" type="submit">
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="panel table-panel" aria-labelledby="daily-log-list-heading">
        <div className="section-heading">
          <h2 id="daily-log-list-heading">Daily Log records</h2>
          <span className="count-pill">{dailyLogs.length}</span>
        </div>

        {dailyLogs.length === 0 ? (
          <div className="empty-state">
            {filtersActive ? (
              <>
                <h3>No Daily Logs match these filters</h3>
                <p>Adjust the search filters or clear them to review all Daily Logs.</p>
                <Link className="button secondary" href="/daily-logs">
                  Clear Filters
                </Link>
              </>
            ) : (
              <>
                <h3>No Daily Logs yet</h3>
                <p>
                  Create the first Daily Log to begin building the date-centered
                  operational history.
                </p>
                <Link className="button primary" href="/daily-logs/new">
                  Add Daily Log
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Mine</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">First activity</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.map((dailyLog) => (
                  <tr key={dailyLog.id}>
                    <td>
                      <strong>{displayDateOnly(dailyLog.logDate)}</strong>
                      <span className="subtle">{optionLabel(shiftOptions, dailyLog.shift)}</span>
                    </td>
                    <td>{dailyLog.summary}</td>
                    <td>
                      {dailyLog.mine
                        ? `${dailyLog.mine.name}, ${dailyLog.mine.city.name}`
                        : "Not set"}
                    </td>
                    <td>{dailyLog.primaryEquipment?.displayName ?? "Not set"}</td>
                    <td>
                      {dailyLog.activities[0]
                        ? optionLabel(
                            dailyLogActivityTypeOptions,
                            dailyLog.activities[0].activityType,
                          )
                        : "None"}
                    </td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/daily-logs/${dailyLog.id}`}>
                        View
                      </Link>
                      <Link className="table-action" href={`/daily-logs/${dailyLog.id}/edit`}>
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
