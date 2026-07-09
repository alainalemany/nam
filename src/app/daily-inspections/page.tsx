import Link from "next/link";

import {
  dailyInspectionConditionOptions,
  dailyInspectionStatusOptions,
  optionLabel,
  shiftOptions,
} from "@/features/daily-inspections/constants";
import {
  displayDateOnly,
  getDailyInspections,
} from "@/features/daily-inspections/data";

export const dynamic = "force-dynamic";

export default async function DailyInspectionsPage() {
  const dailyInspections = await getDailyInspections();

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 id="page-title">Daily Inspections</h1>
          <p className="summary">
            Manual equipment inspection records with findings, condition, and
            defect context.
          </p>
        </div>
        <Link className="button primary" href="/daily-inspections/new">
          New Daily Inspection
        </Link>
      </section>

      <section className="panel table-panel" aria-labelledby="daily-inspection-list-heading">
        <div className="section-heading">
          <h2 id="daily-inspection-list-heading">Daily Inspection records</h2>
          <span className="count-pill">{dailyInspections.length}</span>
        </div>

        {dailyInspections.length === 0 ? (
          <div className="empty-state">
            <h3>No Daily Inspections yet</h3>
            <p>
              Create the first Daily Inspection to begin tracking equipment
              condition and findings.
            </p>
            <Link className="button primary" href="/daily-inspections/new">
              Add Daily Inspection
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Status</th>
                  <th scope="col">Defects</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyInspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>
                      <strong>{displayDateOnly(inspection.inspectionDate)}</strong>
                      <span className="subtle">
                        {optionLabel(shiftOptions, inspection.shift)}
                      </span>
                    </td>
                    <td>
                      {inspection.equipment?.displayName ?? "Not set"}
                      <span className="subtle">
                        {inspection.mine
                          ? `${inspection.mine.name}, ${inspection.mine.city.name}`
                          : "Mine not set"}
                      </span>
                    </td>
                    <td>
                      {optionLabel(dailyInspectionConditionOptions, inspection.condition)}
                    </td>
                    <td>{optionLabel(dailyInspectionStatusOptions, inspection.status)}</td>
                    <td>{inspection.defectsIdentified ? "Yes" : "No"}</td>
                    <td className="action-cell">
                      <Link className="table-action" href={`/daily-inspections/${inspection.id}`}>
                        View
                      </Link>
                      <Link
                        className="table-action"
                        href={`/daily-inspections/${inspection.id}/edit`}
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
