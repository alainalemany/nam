import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DraglineDelayReportLakesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const lakes = await prisma.lake.findMany({
    include: { mine: { include: { city: true } } },
    orderBy: [{ mine: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <main className="page-stack">
      {saved ? (
        <div className="success-confirmation" role="status">Lake saved successfully.</div>
      ) : null}
      <section className="page-header with-actions">
        <div>
          <p className="eyebrow">Dragline reference data</p>
          <h1>Lakes</h1>
          <p className="summary">
            Maintain the Mine-owned Lakes available to Dragline Delay Reports.
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/dragline-delay-reports">Back</Link>
          <Link className="button primary" href="/dragline-delay-reports/lakes/new">Add Lake</Link>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="section-heading">
          <h2>Lake references</h2>
          <span className="count-pill">{lakes.length}</span>
        </div>
        {lakes.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lake</th><th>Mine</th><th>City</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {lakes.map((lake) => (
                  <tr key={lake.id}>
                    <td><strong>{lake.name}</strong></td>
                    <td>{lake.mine.name}</td>
                    <td>{lake.mine.city.name}{lake.mine.city.state ? `, ${lake.mine.city.state}` : ""}</td>
                    <td>{lake.status === "ACTIVE" ? "Active" : lake.status === "INACTIVE" ? "Inactive" : "Archived"}</td>
                    <td><Link className="table-action" href={`/dragline-delay-reports/lakes/${lake.id}/edit`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No Lakes yet</h3>
            <p>Add a Lake before selecting it on a report for that Mine.</p>
            <Link className="button primary" href="/dragline-delay-reports/lakes/new">Add Lake</Link>
          </div>
        )}
      </section>
    </main>
  );
}
