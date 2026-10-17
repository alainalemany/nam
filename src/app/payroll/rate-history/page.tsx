import Link from "next/link";

import { RateHistoryOverview } from "@/features/payroll/RateHistoryOverview";
import { getRateHistoryOverview, type RateHistoryStatusFilter } from "@/features/payroll/rate-history-data";
import { requireEvidenceReviewRoute } from "@/features/payroll/evidence-review-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Search = { status?: string; page?: string };

export default async function RateHistoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireEvidenceReviewRoute();
  const query = await searchParams;
  const allowed: RateHistoryStatusFilter[] = ["all", "open", "resolved", "rejected", "superseded"];
  const status = allowed.includes(query.status as RateHistoryStatusFilter) ? query.status as RateHistoryStatusFilter : "all";
  const data = await getRateHistoryOverview({ status, page: Number(query.page) || 1 });
  return <main className="page-stack payroll-page rate-history-page"><header className="payroll-hero"><div><p className="eyebrow">Protected Payroll workspace</p><h1>Progressive Rate History</h1><p className="summary">Verified exact boundaries, supporting Workday observations, and uncertain rate changes for {data.employee.displayName}.</p></div><div className="payroll-actions"><Link className="button secondary" href="/payroll/evidence-review">Historical Evidence Review</Link><Link className="button secondary" href="/payroll">Back to Payroll</Link></div></header><RateHistoryOverview data={data} /></main>;
}
