import type { SupplyRequestCorrectionActionState } from "./surface-types";

export const emptySupplyRequestCorrectionActionState: SupplyRequestCorrectionActionState =
  {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: {
      expectedCurrentVersionNumber: "",
      correctionReason: "",
      operationalWorkDate: "",
      submittedLocalDate: "",
      submittedLocalTime: "",
      equipmentId: "",
      supervisorId: "",
      notes: "",
      resultingStatus: "REQUESTED",
      fulfillmentOperationalWorkDate: "",
      fulfilledLocalDate: "",
      fulfilledLocalTime: "",
      fulfillmentNote: "",
      cancelledLocalDate: "",
      cancelledLocalTime: "",
      cancellationReason: "",
    },
    items: [],
  };
