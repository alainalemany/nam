export default function Home() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Phase 3.2</p>
        <h1 id="page-title">NAM Dashboard</h1>
        <p className="summary">
          Daily Logs are now the central workday record, supported by operations
          reference data for city, mine, and equipment context.
        </p>
      </section>

      <section className="panel" aria-labelledby="daily-logs-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="daily-logs-heading">Daily Work Log</h2>
          <p>
            Record workday summaries and activity timelines linked to existing
            mine and equipment records.
          </p>
        </div>
        <a className="button primary" href="/daily-logs">
          Open Daily Logs
        </a>
      </section>

      <section className="panel" aria-labelledby="shift-reports-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="shift-reports-heading">Shift Reports</h2>
          <p>
            Preserve shift-level summaries, equipment context, and operational
            notes without owning neighboring module records.
          </p>
        </div>
        <a className="button primary" href="/shift-reports">
          Open Shift Reports
        </a>
      </section>

      <section className="panel" aria-labelledby="defect-tracking-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="defect-tracking-heading">Defect Tracking</h2>
          <p>Track equipment issues, corrective actions, resolution, and closure.</p>
        </div>
        <a className="button primary" href="/defect-tracking">Open Defect Tracking</a>
      </section>

      <section className="panel" aria-labelledby="work-schedule-heading">
        <div>
          <p className="eyebrow">Planning</p>
          <h2 id="work-schedule-heading">Work Schedule</h2>
          <p>
            Preserve weekly equipment assignments with planned crew, actual crew,
            and historical equipment context.
          </p>
        </div>
        <a className="button primary" href="/work-schedule">
          Open Work Schedule
        </a>
      </section>

      <section className="panel" aria-labelledby="work-authorizations-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 id="work-authorizations-heading">Work Authorizations</h2>
          <p>
            Capture shift-scoped maintenance work, permits, lockout context, and
            completion checklist status.
          </p>
        </div>
        <a className="button primary" href="/work-authorizations">
          Open Work Authorizations
        </a>
      </section>

      <section className="panel" aria-labelledby="timesheets-heading">
        <div>
          <p className="eyebrow">Personal Work Administration</p>
          <h2 id="timesheets-heading">Timesheets</h2>
          <p>
            Record payroll-week worked time and reconcile daily Work Allocations.
          </p>
        </div>
        <a className="button primary" href="/timesheets">
          Open Timesheets
        </a>
      </section>

      <section className="panel" aria-labelledby="reference-data-heading">
        <div>
          <p className="eyebrow">Reference data</p>
          <h2 id="reference-data-heading">Equipment foundation</h2>
          <p>
            Create and maintain equipment records with their mine and city
            associations.
          </p>
        </div>
        <a className="button primary" href="/equipment">
          Open Equipment
        </a>
      </section>
    </main>
  );
}
