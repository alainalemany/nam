import { notFound } from "next/navigation";

import {
  removeSupplyRequestDailyLogLinkAction,
  setSupplyRequestDailyLogLinkAction,
} from "@/features/supply-requests/daily-log-link-actions";
import { getSupplyRequestDailyLogLinkContext } from "@/features/supply-requests/daily-log-link-data";
import { SupplyRequestDailyLogLinkForm } from "@/features/supply-requests/SupplyRequestDailyLogLinkForm";

export const dynamic = "force-dynamic";

export default async function SubmissionDailyLogLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSupplyRequestDailyLogLinkContext(id, "SUBMISSION");
  if (result.status === "not-found") notFound();
  if (result.status === "error") {
    return <main className="page-stack"><section className="panel" role="alert"><h1>Daily Log link unavailable</h1><p>{result.message}</p><a className="button secondary" href={`/supply-requests/${encodeURIComponent(id)}`}>Back to Supply Request</a></section></main>;
  }
  return <SupplyRequestDailyLogLinkForm context={result.context} setAction={setSupplyRequestDailyLogLinkAction.bind(null, result.context.supplyRequestId, "SUBMISSION")} removeAction={removeSupplyRequestDailyLogLinkAction.bind(null, result.context.supplyRequestId, "SUBMISSION")} />;
}
