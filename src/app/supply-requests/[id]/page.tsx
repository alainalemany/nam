import { notFound } from "next/navigation";

import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";
import { getCurrentSupplyRequestDetail } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function SupplyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCurrentSupplyRequestDetail(id);
  if (!detail) notFound();
  return <SupplyRequestDetail detail={detail} />;
}
