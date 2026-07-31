import { notFound } from "next/navigation";

import { SupplyRequestCorrectionForm } from "@/features/supply-requests/SupplyRequestCorrectionForm";
import { getSupplyRequestCorrectionContext } from "@/features/supply-requests/surface-data";
import type { SupplyRequestCorrectionActionState } from "@/features/supply-requests/surface-types";

export const dynamic = "force-dynamic";

export default async function CorrectSupplyRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getSupplyRequestCorrectionContext(id);
  if (!context) notFound();
  const detail = context.detail;
  const initialState: SupplyRequestCorrectionActionState = {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: {
      expectedCurrentVersionNumber: String(detail.versionNumber),
      correctionReason: "",
      operationalWorkDate: detail.operationalWorkDate,
      submittedLocalDate: detail.submittedLocalDate,
      submittedLocalTime: detail.submittedLocalTime,
      equipmentId: detail.equipmentId ?? "",
      supervisorId: detail.supervisorId,
      notes: detail.notes ?? "",
      resultingStatus: detail.status,
      fulfillmentOperationalWorkDate:
        detail.fulfillmentOperationalWorkDate ?? "",
      fulfilledLocalDate: detail.fulfilledLocalDate ?? "",
      fulfilledLocalTime: detail.fulfilledLocalTime ?? "",
      fulfillmentNote: detail.fulfillmentNote ?? "",
      cancelledLocalDate: detail.cancellationLocalDate ?? "",
      cancelledLocalTime: detail.cancellationLocalTime ?? "",
      cancellationReason: detail.cancellationReason ?? "",
    },
    items: detail.items.map((item) => ({
      supplyItemId: item.supplyItemId,
      quantity: item.quantity,
    })),
  };
  return (
    <SupplyRequestCorrectionForm
      context={context}
      initialState={initialState}
    />
  );
}
