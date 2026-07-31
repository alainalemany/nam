import { notFound } from "next/navigation";

import { SupplyRequestDetail } from "@/features/supply-requests/SupplyRequestDetail";
import { getImmutableSupplyRequestVersion } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function SupplyRequestOriginalVersionPage({
  params,
}: {
  params: Promise<{ id: string; version: string }>;
}) {
  const { id, version } = await params;
  const result = await getImmutableSupplyRequestVersion(id, version);
  if (!result) notFound();
  return (
    <SupplyRequestDetail
      detail={result.detail}
      historicalRole={result.role}
    />
  );
}
