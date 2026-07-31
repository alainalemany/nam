import { notFound } from "next/navigation";

import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";
import { getSupplyRequestCurrentPageData } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function SupplyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getSupplyRequestCurrentPageData>>;
  try {
    data = await getSupplyRequestCurrentPageData(id);
  } catch {
    return (
      <main className="page-stack">
        <section className="panel" role="alert">
          <h1>Supply Request detail unavailable</h1>
          <p>
            Current detail or Daily Log link information could not be loaded
            safely. Reload and try again.
          </p>
          <a className="button secondary" href="/supply-requests">
            Supply Request History
          </a>
        </section>
      </main>
    );
  }
  if (!data) notFound();
  return (
    <SupplyRequestDetail
      detail={data.detail}
      history={data.history}
      dailyLogLinks={data.dailyLogLinks}
    />
  );
}
