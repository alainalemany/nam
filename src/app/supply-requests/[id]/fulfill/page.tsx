import { notFound } from "next/navigation";

import {
  SupplyRequestLifecycleForm,
  SupplyRequestLifecycleUnavailable,
} from "@/features/supply-requests/SupplyRequestLifecycleForm";
import { getSupplyRequestLifecycleActionContext } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function FulfillSupplyRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getSupplyRequestLifecycleActionContext(id);
  if (!context) notFound();
  return context.status === "REQUESTED" ? (
    <SupplyRequestLifecycleForm context={context} mode="fulfill" />
  ) : (
    <SupplyRequestLifecycleUnavailable
      actionLabel="Fulfillment"
      context={context}
    />
  );
}
