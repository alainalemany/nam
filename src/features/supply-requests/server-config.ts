export type SupplyRequestRequesterConfiguration = Readonly<{
  displayName: string;
  employeeNumber: string;
}>;

// This non-secret product configuration is owned by the server-side Supply
// Requests persistence boundary. It is not request input or environment state.
export const supplyRequestRequester = Object.freeze({
  displayName: "Alain Alemany",
  employeeNumber: "911601",
}) satisfies SupplyRequestRequesterConfiguration;
