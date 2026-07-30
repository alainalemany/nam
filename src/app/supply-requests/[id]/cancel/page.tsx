import { notFound } from "next/navigation";

import {
  SupplyRequestLifecycleForm,
  SupplyRequestLifecycleUnavailable,
} from "@/features/supply-requests/SupplyRequestLifecycleForm";
import { getSupplyRequestLifecycleActionContext } from "@/features/supply-requests/surface-data";

export const dynamic = "force-dynamic";

export default async function CancelSupplyRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getSupplyRequestLifecycleActionContext(id);
  if (!context) notFound();
  return context.status === "REQUESTED" ? (
    <SupplyRequestLifecycleForm context={context} mode="cancel" />
  ) : (
    <SupplyRequestLifecycleUnavailable
      actionLabel="Cancellation"
      context={context}
    />
  );
}
