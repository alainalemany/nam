import Link from "next/link";

import {
  knowledgeContentKindLabels,
  knowledgeContextKindLabels,
  knowledgeDisclaimer,
  knowledgeUnverifiedWarning,
} from "./constants";
import {
  hasKnowledgeListFilters,
  knowledgeListHref,
  type KnowledgeListFilters,
} from "./list-params";
import type {
  KnowledgeListOption,
  KnowledgeListPageReady,
} from "./list-types";

function unavailableOption(
  options: readonly KnowledgeListOption[],
  selectedId: string | undefined,
) {
  return selectedId && !options.some((option) => option.id === selectedId) ? (
    <option value={selectedId}>Unavailable live reference</option>
  ) : null;
}

function optionRows(options: readonly KnowledgeListOption[]) {
  return options.map((option) => (
    <option key={option.id} value={option.id}>
      {option.label}
      {option.active ? "" : " (Inactive)"}
    </option>
  ));
}

function KnowledgeFilters({
  filters,
  data,
}: {
  filters: KnowledgeListFilters;
  data: KnowledgeListPageReady;
}) {
  return (
    <section className="panel knowledge-list-filters" aria-labelledby="knowledge-list-filters">
      <form action="/knowledge-base" className="form-stack" method="get">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Discovery</p>
            <h2 id="knowledge-list-filters">Search and filter</h2>
          </div>
          {hasKnowledgeListFilters(filters) ? (
            <Link className="button secondary" href="/knowledge-base">
              Clear filters
            </Link>
          ) : null}
        </div>
        <label htmlFor="knowledge-search">
          <span>Search current title and body</span>
        </label>
        <input
          defaultValue={filters.q ?? ""}
          id="knowledge-search"
          name="q"
          type="search"
          aria-describedby="knowledge-search-help"
        />
        <p className="field-help" id="knowledge-search-help">
          Search uses simple case-insensitive text matching. It does not search retained history or external references.
        </p>
        <fieldset>
          <legend>Knowledge Record filters</legend>
          <div className="form-grid">
            <label>
              <span>Lifecycle</span>
              <select defaultValue={filters.lifecycle} name="lifecycle">
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
                <option value="ALL">Active and Archived</option>
              </select>
            </label>
            <label>
              <span>Content kind</span>
              <select defaultValue={filters.kind ?? ""} name="kind">
                <option value="">Any kind</option>
                {Object.entries(knowledgeContentKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Trust</span>
              <select defaultValue={filters.trust ?? ""} name="trust">
                <option value="">Any trust state</option>
                <option value="UNVERIFIED">Unverified</option>
                <option value="PERSONALLY_REVIEWED">Personally Reviewed</option>
              </select>
            </label>
            <label>
              <span>Context</span>
              <select defaultValue={filters.context ?? ""} name="context">
                <option value="">Any context</option>
                {Object.entries(knowledgeContextKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Mine</span>
              <select defaultValue={filters.mineId ?? ""} name="mineId">
                <option value="">Any live Mine</option>
                {unavailableOption(data.mineOptions, filters.mineId)}
                {optionRows(data.mineOptions)}
              </select>
            </label>
            <label>
              <span>Equipment</span>
              <select defaultValue={filters.equipmentId ?? ""} name="equipmentId">
                <option value="">Any live Equipment</option>
                {unavailableOption(data.equipmentOptions, filters.equipmentId)}
                {optionRows(data.equipmentOptions)}
              </select>
            </label>
            <label>
              <span>Order</span>
              <select defaultValue={filters.sort} name="sort">
                <option value="UPDATED_DESC">Recently updated</option>
                <option value="TITLE_ASC">Title A–Z</option>
              </select>
            </label>
          </div>
        </fieldset>
        <div className="filter-actions">
          <button className="button primary" type="submit">Apply search and filters</button>
        </div>
      </form>
    </section>
  );
}

function selectedOptionLabel(
  options: readonly KnowledgeListOption[],
  selectedId: string,
) {
  return options.find((option) => option.id === selectedId)?.label ??
    "Unavailable live reference";
}

function activeFilterSummary(
  filters: KnowledgeListFilters,
  data: KnowledgeListPageReady,
) {
  const values: string[] = [];
  if (filters.q) values.push(`Search: “${filters.q}”`);
  if (filters.lifecycle !== "ACTIVE") {
    values.push(filters.lifecycle === "ALL" ? "Lifecycle: Active and Archived" : "Lifecycle: Archived");
  }
  if (filters.kind) values.push(`Kind: ${knowledgeContentKindLabels[filters.kind]}`);
  if (filters.trust) values.push(`Trust: ${filters.trust === "UNVERIFIED" ? "Unverified" : "Personally Reviewed"}`);
  if (filters.context) values.push(`Context: ${knowledgeContextKindLabels[filters.context]}`);
  if (filters.mineId) {
    values.push(`Mine: ${selectedOptionLabel(data.mineOptions, filters.mineId)}`);
  }
  if (filters.equipmentId) {
    values.push(
      `Equipment: ${selectedOptionLabel(data.equipmentOptions, filters.equipmentId)}`,
    );
  }
  if (filters.sort === "TITLE_ASC") values.push("Order: Title A–Z");
  return values;
}

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function EmptyResults({
  data,
  filters,
}: {
  data: KnowledgeListPageReady;
  filters: KnowledgeListFilters;
}) {
  if (data.totalCount === 0) {
    return (
      <div className="empty-state">
        <h3>No Knowledge Records exist yet</h3>
        <p>Create the first reusable personal operational knowledge record.</p>
        <Link className="button primary" href="/knowledge-base/new">Create Knowledge Record</Link>
      </div>
    );
  }
  if (data.outOfRange) {
    const lastPage = Math.max(data.pageCount, 1);
    return (
      <div className="empty-state">
        <h3>Requested page is out of range</h3>
        <p>No records were lost. Choose an available page for the current search and filters.</p>
        <div className="inline-actions">
          <Link className="button secondary" href={knowledgeListHref(filters, { page: 1 })}>First page</Link>
          {lastPage > 1 ? (
            <Link className="button secondary" href={knowledgeListHref(filters, { page: lastPage })}>Last available page</Link>
          ) : null}
        </div>
      </div>
    );
  }
  if (data.activeCount === 0 && !hasKnowledgeListFilters(filters)) {
    return (
      <div className="empty-state">
        <h3>Only Archived Knowledge Records exist</h3>
        <p>Active records remain the default view. Open the Archived view to read retained records.</p>
        <Link className="button secondary" href={knowledgeListHref(filters, { lifecycle: "ARCHIVED" })}>View Archived records</Link>
      </div>
    );
  }
  return (
    <div className="empty-state">
      <h3>No records match this search and filters</h3>
      <p>Adjust the current criteria or clear them. Existing records have not been removed.</p>
      <Link className="button secondary" href="/knowledge-base">Clear filters</Link>
    </div>
  );
}

export function KnowledgeRecordList({
  data,
  filters,
  invalidParameters,
}: {
  data: KnowledgeListPageReady;
  filters: KnowledgeListFilters;
  invalidParameters: readonly string[];
}) {
  const active = activeFilterSummary(filters, data);
  const presentsUnverifiedContent = data.rows.some(
    (row) => row.trust === "UNVERIFIED",
  );
  return (
    <>
      <section className="notice-stack" aria-labelledby="knowledge-list-safety">
        <h2 id="knowledge-list-safety">Safety and authority</h2>
        <p>{knowledgeDisclaimer}</p>
        {presentsUnverifiedContent ? (
          <p role="status"><strong>{knowledgeUnverifiedWarning}</strong></p>
        ) : null}
      </section>
      <KnowledgeFilters data={data} filters={filters} />
      {invalidParameters.length ? (
        <div className="form-alert" role="status">
          Unsupported, repeated, or invalid values were ignored for: {invalidParameters.join(", ")}.
        </div>
      ) : null}
      <section className="panel knowledge-list-results" aria-labelledby="knowledge-results">
        <div className="section-heading">
          <div>
            <h2 id="knowledge-results">Knowledge Records</h2>
            {active.length ? <p className="field-help">Active filters: {active.join("; ")}</p> : <p className="field-help">Default view: Active records, recently updated.</p>}
          </div>
          <p className="count-pill" role="status" aria-live="polite">
            {data.matchingCount} {data.matchingCount === 1 ? "result" : "results"}
          </p>
        </div>
        {data.rows.length === 0 ? (
          <EmptyResults data={data} filters={filters} />
        ) : (
          <>
            <div className="knowledge-result-grid">
              {data.rows.map((row) => (
                <article className="knowledge-result-card" key={row.id}>
                  <div className="section-heading">
                    <h3><Link href={row.detailHref}>{row.title}</Link></h3>
                    <div className="badge-row" aria-label="Record status">
                      <span className="status-badge">{row.contentKindLabel}</span>
                      <span className="status-badge">{row.trustLabel}</span>
                      <span className="status-badge">{row.lifecycleLabel}</span>
                    </div>
                  </div>
                  <p>{row.excerpt}</p>
                  <dl className="knowledge-result-facts">
                    <div><dt>Context</dt><dd>{row.contextSummary}{row.contextAvailability ? ` (${row.contextAvailability})` : ""}</dd></div>
                    <div><dt>Updated</dt><dd><time dateTime={row.updatedAt}>{updatedLabel(row.updatedAt)}</time></dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <nav className="pagination" aria-label="Knowledge Base result pages">
              {data.hasPreviousPage ? (
                <Link className="button secondary" href={knowledgeListHref(filters, { page: data.page - 1 })}>Previous</Link>
              ) : <span aria-disabled="true">Previous unavailable</span>}
              <span aria-current="page">Page {data.page}{data.pageCount ? ` of ${data.pageCount}` : ""}</span>
              {data.hasNextPage ? (
                <Link className="button secondary" href={knowledgeListHref(filters, { page: data.page + 1 })}>Next</Link>
              ) : <span aria-disabled="true">Next unavailable</span>}
            </nav>
          </>
        )}
      </section>
    </>
  );
}
