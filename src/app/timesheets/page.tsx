import Link from "next/link";

import {
  equipmentCategoryOptions,
  optionLabel as equipmentOptionLabel,
} from "@/features/equipment/constants";
import { formatMinutes } from "@/features/timesheets/calculations";
import { timesheetStatusLabels } from "@/features/timesheets/constants";
import {
  getTimesheetHistory,
  getTimesheetHistoryFilterOptions,
} from "@/features/timesheets/data";
import {
  hasTimesheetHistoryFilters,
  parseTimesheetHistoryFilters,
  timesheetHistoryPageHref,
  type TimesheetSearchParams,
} from "@/features/timesheets/filters";
import type {
  TimesheetHistoryFilterOption,
  TimesheetHistoryFilterOptions,
} from "@/features/timesheets/types";

export const dynamic = "force-dynamic";

type TimesheetsPageProps = {
  searchParams?: Promise<TimesheetSearchParams>;
};

function displayDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function referenceOptions(
  options: TimesheetHistoryFilterOption[],
  selectedValue: string | undefined,
) {
  const selectedExists = options.some((option) => option.id === selectedValue);

  return (
    <>
      {selectedValue && !selectedExists ? (
        <option value={selectedValue}>Unavailable historical reference</option>
      ) : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
          {option.active ? "" : " (Inactive)"}
        </option>
      ))}
    </>
  );
}

function TimesheetHistoryFilters({
  filters,
  options,
}: {
  filters: ReturnType<typeof parseTimesheetHistoryFilters>["filters"];
  options: TimesheetHistoryFilterOptions;
}) {
  const filtersActive = hasTimesheetHistoryFilters(filters);

  return (
    <section
      className="panel filter-panel"
      aria-labelledby="timesheet-filters-heading"
    >
      <form action="/timesheets" className="form-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h2 id="timesheet-filters-heading">Find Timesheets</h2>
          </div>
          {filtersActive ? (
            <Link className="button secondary" href="/timesheets">
              Clear Filters
            </Link>
          ) : null}
        </div>

        <div className="form-grid">
          <label>
            <span>Payroll week from</span>
            <input
              defaultValue={filters.dateFrom ?? ""}
              name="dateFrom"
              type="date"
            />
          </label>
          <label>
            <span>Payroll week to</span>
            <input
              defaultValue={filters.dateTo ?? ""}
              name="dateTo"
              type="date"
            />
          </label>
          <label>
            <span>Status</span>
            <select defaultValue={filters.status ?? ""} name="status">
              <option value="">Any status</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <label>
            <span>Equipment</span>
            <select
              defaultValue={filters.equipmentId ?? ""}
              name="equipmentId"
            >
              <option value="">Any equipment</option>
              {referenceOptions(options.equipment, filters.equipmentId)}
            </select>
          </label>
          <label>
            <span>Work Code</span>
            <select
              defaultValue={filters.workCodeId ?? ""}
              name="workCodeId"
            >
              <option value="">Any Work Code</option>
              {referenceOptions(options.workCodes, filters.workCodeId)}
            </select>
          </label>
          <label>
            <span>Work Order</span>
            <select
              defaultValue={filters.workOrderId ?? ""}
              name="workOrderId"
            >
              <option value="">Any Work Order</option>
              {referenceOptions(options.workOrders, filters.workOrderId)}
            </select>
          </label>
          <label>
            <span>Support Personnel</span>
            <select
              defaultValue={filters.supportPersonId ?? ""}
              name="supportPersonId"
            >
              <option value="">Any Support Personnel</option>
              {referenceOptions(
                options.supportPersonnel,
                filters.supportPersonId,
              )}
            </select>
          </label>
          <label>
            <span>Overtime</span>
            <select
              defaultValue={filters.hasOvertime ? "true" : ""}
              name="hasOvertime"
            >
              <option value="">Any overtime</option>
              <option value="true">Has overtime</option>
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
  );
}

export default async function TimesheetsPage({
  searchParams,
}: TimesheetsPageProps) {
  const parsed = parseTimesheetHistoryFilters((await searchParams) ?? {});
  const { filters, ignoredInvalidParameters } = parsed;
  const filtersActive = hasTimesheetHistoryFilters(filters);
  const [history, options] = await Promise.all([
    getTimesheetHistory(filters),
    getTimesheetHistoryFilterOptions(),
  ]);

  return (
    <main className="page-stack">
      <section
        className="page-header with-actions"
        aria-labelledby="page-title"
      >
        <div>
          <p className="eyebrow">Personal Work Administration</p>
          <h1 id="page-title">Timesheets</h1>
          <p className="summary">
            Find prior payroll weeks, review stored daily work, and reopen Draft
            Timesheets when changes are needed.
          </p>
        </div>
        <Link className="button primary" href="/timesheets/new">
          Open Payroll Week
        </Link>
      </section>

      <TimesheetHistoryFilters filters={filters} options={options} />

      {ignoredInvalidParameters ? (
        <div className="form-alert" role="status">
          Some invalid Timesheet filter parameters were ignored.
        </div>
      ) : null}

      <section
        className="panel table-panel"
        aria-labelledby="timesheet-list-heading"
      >
        <div className="section-heading">
          <h2 id="timesheet-list-heading">Timesheet history</h2>
          <span className="count-pill">{history.matchingCount}</span>
        </div>

        {history.totalCount === 0 ? (
          <div className="empty-state">
            <h3>No Timesheets yet</h3>
            <p>
              Opening the entry screen does not create a record. The first save
              creates the payroll week and its entries atomically.
            </p>
            <Link className="button primary" href="/timesheets/new">
              Enter worked time
            </Link>
          </div>
        ) : history.items.length === 0 &&
          filtersActive &&
          history.matchingCount === 0 ? (
          <div className="empty-state">
            <h3>No Timesheets match these filters</h3>
            <p>Adjust the filters or clear them to review all Timesheets.</p>
            <Link className="button secondary" href="/timesheets">
              Clear Filters
            </Link>
          </div>
        ) : history.items.length === 0 && history.page > 1 ? (
          <div className="empty-state">
            <h3>No Timesheets on this page</h3>
            <p>The requested result page is beyond the available Timesheets.</p>
            <Link
              className="button secondary"
              href={timesheetHistoryPageHref(filters, history.page - 1)}
            >
              Previous
            </Link>
          </div>
        ) : history.items.length === 0 ? (
          <div className="empty-state">
            <h3>No Timesheets available</h3>
            <p>No Timesheets are available on the requested page.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Payroll week</th>
                    <th scope="col">Employee</th>
                    <th scope="col">Status</th>
                    <th scope="col">Daily entries</th>
                    <th scope="col">Weekly totals</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {displayDate(item.payrollWeekStartDate)} -{" "}
                        {displayDate(item.payrollWeekEndDate)}
                      </td>
                      <td>{item.primaryEmployeeDisplayName}</td>
                      <td>{timesheetStatusLabels[item.status]}</td>
                      <td>
                        {item.entries.length > 0 ? (
                          <ol
                            className="compact-list"
                            aria-label={`${item.entryCount} Daily Time Entries`}
                          >
                            {item.entries.map((entry) => (
                              <li key={entry.id}>
                                <strong>
                                  {displayDate(entry.workDate)} ·{" "}
                                  {entry.equipmentIdentity} ·{" "}
                                  {equipmentOptionLabel(
                                    equipmentCategoryOptions,
                                    entry.equipmentCategory,
                                  )}
                                </strong>
                                <span>
                                  Worked {formatMinutes(entry.workedMinutes)} ·
                                  Regular {formatMinutes(entry.regularMinutes)} ·
                                  Overtime {formatMinutes(entry.overtimeMinutes)}
                                </span>
                                <span className="subtle">
                                  {entry.allocationSummaries.join("; ")}
                                </span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <span className="subtle">No Daily Time Entries</span>
                        )}
                      </td>
                      <td>
                        <strong>
                          Worked {formatMinutes(item.workedMinutesTotal)}
                        </strong>
                        <span className="subtle">
                          Regular {formatMinutes(item.regularMinutesTotal)} ·
                          Overtime {formatMinutes(item.overtimeMinutesTotal)}
                        </span>
                      </td>
                      <td className="action-cell">
                        <Link
                          className="table-action"
                          href={`/timesheets/${item.id}`}
                        >
                          View
                        </Link>
                        {item.status === "DRAFT" ? (
                          <Link
                            className="table-action"
                            href={`/timesheets/${item.id}/edit`}
                          >
                            Edit
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {history.hasPreviousPage || history.hasNextPage ? (
              <nav className="inline-actions" aria-label="Timesheet history pages">
                {history.hasPreviousPage ? (
                  <Link
                    className="button secondary"
                    href={timesheetHistoryPageHref(filters, history.page - 1)}
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="subtle">Page {history.page}</span>
                {history.hasNextPage ? (
                  <Link
                    className="button secondary"
                    href={timesheetHistoryPageHref(filters, history.page + 1)}
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </section>

      <section className="panel">
        <div>
          <h2>Timesheet reference data</h2>
          <p>Manage reusable accounting references separately from weekly entry.</p>
          <div className="inline-actions">
            <Link className="button secondary" href="/timesheets/work-codes">
              Work Codes
            </Link>
            <Link className="button secondary" href="/timesheets/work-orders">
              Work Orders
            </Link>
            <Link
              className="button secondary"
              href="/timesheets/support-personnel"
            >
              Support Personnel
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
