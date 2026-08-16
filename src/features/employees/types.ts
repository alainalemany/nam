export type EmployeeFormValues = {
  displayName: string;
  employeeCode: string;
  isActive: boolean;
  isSupervisor: boolean;
};

export type EmployeeFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: Partial<Record<keyof EmployeeFormValues | "form", string[]>>;
  values?: EmployeeFormValues;
};

export const emptyEmployeeFormState: EmployeeFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
