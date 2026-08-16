import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmployeeForm } from "@/features/employees/EmployeeForm";

vi.mock("@/features/employees/actions", () => ({
  createEmployeeAction: vi.fn(),
  updateEmployeeAction: vi.fn(),
}));

afterEach(cleanup);

describe("EmployeeForm", () => {
  it("defaults new Employees to active and not supervisor eligible", () => {
    render(<EmployeeForm />);

    expect(screen.getByLabelText("Display Name")).toBeRequired();
    expect(screen.getByLabelText("Employee Code")).not.toBeRequired();
    expect(screen.getByLabelText("Active — available for new selections")).toBeChecked();
    expect(screen.getByLabelText("Supervisor — eligible for Assigned By")).not.toBeChecked();
  });

  it("renders editable values for an existing Employee", () => {
    render(
      <EmployeeForm
        id="employee-1"
        initial={{
          displayName: "Sam Supervisor",
          employeeCode: "400",
          isActive: false,
          isSupervisor: true,
        }}
      />,
    );

    expect(screen.getByLabelText("Display Name")).toHaveValue("Sam Supervisor");
    expect(screen.getByLabelText("Employee Code")).toHaveValue("400");
    expect(screen.getByLabelText("Active — available for new selections")).not.toBeChecked();
    expect(screen.getByLabelText("Supervisor — eligible for Assigned By")).toBeChecked();
  });
});
