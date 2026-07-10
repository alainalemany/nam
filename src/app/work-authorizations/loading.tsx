export default function WorkAuthorizationsLoading() {
  return (
    <main className="page-stack">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operations</p>
        <h1 id="page-title">Work Authorizations</h1>
        <p className="summary">Loading Work Authorization records.</p>
      </section>

      <section className="panel">
        <div className="skeleton-list" aria-label="Loading Work Authorizations">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}
