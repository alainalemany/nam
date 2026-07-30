import { notFound } from "next/navigation";

import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";
import { getOriginalSupplyRequestDetail } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function SupplyRequestOriginalVersionPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const detail = await getOriginalSupplyRequestDetail(id, version);
  if (!detail) notFound();
  return <SupplyRequestDetail detail={detail} historical />;
}
