import Link from "next/link";

import {
  optionLabel,
  workAuthorizationStatusOptions,
  workAuthorizationWorkTypeOptions,
} from "@/features/work-authorizations/constants";
import {
  displayDateOnly,
  getWorkAuthorizations,
} from "@/features/work-authorizations/data";

export const dynamic = "force-dynamic";

export default async function WorkAuthorizationsPage() {
  const workAuthorizations = await getWorkAuthorizations();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Work Authorizations</h1>
          <p className="summary">
            Shift-scoped maintenance and safety work authorization records.
          </p>
        </div>
        <Link className="button primary" href="/work-authorizations/new">
          New Work Authorization
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="authorization-list-heading">
        <div className="section-heading">
          <h2 id="authorization-list-heading">Work Authorization records</h2>
          <span className="count-pill">{workAuthorizations.length}</span>
        </div>

        {workAuthorizations.length === 0 ? (
          <div className="empty-state">
            <h3>No Work Authorizations yet</h3>
            <p>
              Create the first Work Authorization from the correct Shift Report
              context.
            </p>
            <Link className="button primary" href="/work-authorizations/new">
              Add Work Authorization
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Shift</th>
                  <th scope="col">Work</th>
                  <th scope="col">Status</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workAuthorizations.map((authorization) => (
                  <tr key={authorization.id}>
                    <td>
                      <strong>{displayDateOnly(authorization.shiftReport.reportDate)}</strong>
                      <span className="subtle">{authorization.shiftReport.shift}</span>
                    </td>
                    <td>
                      {optionLabel(workAuthorizationWorkTypeOptions, authorization.workType)}
                      <span className="subtle">{authorization.workDescription}</span>
                    </td>
                    <td>
                      {optionLabel(workAuthorizationStatusOptions, authorization.status)}
                    </td>
                    <td>
                      {authorization.equipment?.displayName ?? "Not set"}
                      <span className="subtle">
                        {authorization.mine
                          ? `${authorization.mine.name}, ${authorization.mine.city.name}`
                          : authorization.jobLocation ?? "Context not set"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}`}
                      >
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/work-authorizations/${authorization.id}/edit`}
                      >
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
