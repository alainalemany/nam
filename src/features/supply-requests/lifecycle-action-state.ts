export type SupplyRequestLifecycleActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  values: Readonly<{
    expectedCurrentVersionNumber: string;
    fulfillmentOperationalWorkDate: string;
    fulfillmentNote: string;
    cancellationReason: string;
  }>;
}>;

export const emptySupplyRequestLifecycleActionState: SupplyRequestLifecycleActionState =
  {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: {
      expectedCurrentVersionNumber: "",
      fulfillmentOperationalWorkDate: "",
      fulfillmentNote: "",
      cancellationReason: "",
    },
  };
