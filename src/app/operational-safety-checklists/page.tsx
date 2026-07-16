import Link from "next/link";

import {
  safetyChecklistOptionLabel,
  safetyChecklistResponseLabels,
  safetyChecklistShiftOptions,
  safetyChecklistTemplateLabels,
} from "@/features/operational-safety-checklists/constants";
import {
  displaySafetyChecklistDate,
  getOperationalSafetyChecklists,
  getSafetyChecklistFilterOptions,
} from "@/features/operational-safety-checklists/data";
import {
  hasSafetyChecklistFilters,
  parseSafetyChecklistFilters,
  type SafetyChecklistSearchParams,
} from "@/features/operational-safety-checklists/filters";

export const dynamic = "force-dynamic";

type OperationalSafetyChecklistsPageProps = {
  searchParams?: Promise<SafetyChecklistSearchParams>;
};

export default async function OperationalSafetyChecklistsPage({
  searchParams,
}: OperationalSafetyChecklistsPageProps) {
  const filters = parseSafetyChecklistFilters((await searchParams) ?? {});
  const [records, equipmentOptions] = await Promise.all([
    getOperationalSafetyChecklists(filters),
    getSafetyChecklistFilterOptions(),
  ]);
  const filtersActive = hasSafetyChecklistFilters(filters);

  return (
    <main className="page-stack">
      <section className="page-header with-actions" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Daily Inspections</p>
          <h1 id="page-title">Operational Safety Checklists</h1>
          <p className="summary">
            Completed Dragline and Mobile pre-shift inspections for the actual
            Equipment used.
          </p>
        </div>
        <Link className="button primary" href="/operational-safety-checklists/new">
          Complete Checklist
        </Link>
      </section>

      <section className="panel filter-panel" aria-labelledby="checklist-filters-heading">
        <form action="/operational-safety-checklists" className="form-stack">
          <div className="section-heading">
            <h2 id="checklist-filters-heading">Find checklists</h2>
            {filtersActive ? <Link className="button secondary" href="/operational-safety-checklists">Clear</Link> : null}
          </div>
          <div className="form-grid">
            <label><span>From</span><input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" /></label>
            <label><span>To</span><input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" /></label>
            <label>
              <span>Equipment</span>
              <select defaultValue={filters.equipmentId ?? ""} name="equipmentId">
                <option value="">All Equipment</option>
                {equipmentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span>Template</span>
              <select defaultValue={filters.template ?? ""} name="template">
                <option value="">All templates</option>
                {Object.entries(safetyChecklistTemplateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Shift</span>
              <select defaultValue={filters.shift ?? ""} name="shift">
                <option value="">All shifts</option>
                {safetyChecklistShiftOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label><span>Operator</span><input defaultValue={filters.operator ?? ""} name="operator" /></label>
            <label><span>Supervisor</span><input defaultValue={filters.supervisor ?? ""} name="supervisor" /></label>
            <label>
              <span>Response condition</span>
              <select defaultValue={filters.condition ?? ""} name="condition">
                <option value="">All responses</option>
                {Object.entries(safetyChecklistResponseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="filter-actions"><button className="button primary" type="submit">Apply Filters</button></div>
        </form>
      </section>

      <section className="panel table-panel" aria-labelledby="checklist-list-heading">
        <div className="section-heading">
          <h2 id="checklist-list-heading">Completed checklists</h2>
          <span className="count-pill">{records.length}</span>
        </div>
        {records.length === 0 ? (
          <div className="empty-state">
            <h3>{filtersActive ? "No matching checklists" : "No checklists yet"}</h3>
            <p>{filtersActive ? "Clear or adjust the current filters." : "Complete the first pre-shift Equipment inspection."}</p>
            {filtersActive ? <Link className="button secondary" href="/operational-safety-checklists">Clear Filters</Link> : <Link className="button primary" href="/operational-safety-checklists/new">Complete Checklist</Link>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Equipment</th><th>Template</th><th>Shift</th><th>Operator</th><th>Conditions</th><th>Actions</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{displaySafetyChecklistDate(record.inspectionDate)}</td>
                    <td>{record.equipmentDisplayName}<span className="subtle">{record.equipmentNumber ?? "No Equipment number"} · {record.mineName}</span></td>
                    <td>{record.templateName}<span className="subtle">Version {record.templateVersion}</span></td>
                    <td>{safetyChecklistOptionLabel(safetyChecklistShiftOptions, record.shift)}</td>
                    <td>{record.operatorDisplayName}<span className="subtle">Supervisor: {record.supervisorDisplayName}</span></td>
                    <td>{record.needsRepairCount} Needs Repair<span className="subtle">{record.previouslyNotedCount} Previously Noted</span></td>
                    <td className="action-cell"><Link className="table-action" href={`/operational-safety-checklists/${record.id}`}>View</Link><Link className="table-action" href={`/operational-safety-checklists/${record.id}/edit`}>Correct</Link></td>
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
