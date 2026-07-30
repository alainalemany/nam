export type ReferenceActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
  values: Readonly<Record<string, string>>;
};

export const emptyReferenceActionState: ReferenceActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  values: {},
};
