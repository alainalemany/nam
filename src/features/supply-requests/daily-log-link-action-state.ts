export type SupplyRequestDailyLogLinkActionState = Readonly<{
  status: "idle" | "error";
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  selectedActivityId: string;
}>;

export const emptySupplyRequestDailyLogLinkActionState: SupplyRequestDailyLogLinkActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  selectedActivityId: "",
};
