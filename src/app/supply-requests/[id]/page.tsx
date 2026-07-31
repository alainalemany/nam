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
  const data = await getSupplyRequestCurrentPageData(id);
  if (!data) notFound();
  return <SupplyRequestDetail detail={data.detail} history={data.history} />;
}
