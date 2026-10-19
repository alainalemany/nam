const employeeIdPattern = /^[A-Za-z0-9_-]{1,191}$/u;

export function configuredOwnerEmployeeId() {
  const value = process.env.NAM_PAYROLL_OWNER_EMPLOYEE_ID?.trim() ?? "";
  return employeeIdPattern.test(value) && !/^replace-with-/i.test(value) ? value : "";
}

export function activeConfiguredOwnerId(
  employees: Array<{ id: string; isActive: boolean }>,
) {
  const configuredId = configuredOwnerEmployeeId();
  return employees.find((employee) => employee.id === configuredId && employee.isActive)?.id ?? "";
}
