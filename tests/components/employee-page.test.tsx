import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EmployeesPage from "@/app/employees/page";

vi.mock("@/features/employees/data", () => ({
  getEmployees: vi.fn().mockResolvedValue([
    {
      id: "employee-1",
      displayName: "Alain Alemany Arana",
      employeeCode: "911601",
      isActive: true,
      isSupervisor: false,
      createdAt: new Date("2026-08-16T00:00:00.000Z"),
      updatedAt: new Date("2026-08-16T00:00:00.000Z"),
    },
  ]),
}));

describe("Employees page", () => {
  it("renders the canonical Employee list and edit action", async () => {
    render(await EmployeesPage());

    expect(screen.getByRole("heading", { name: "Employees" })).toBeInTheDocument();
    expect(screen.getByText("Alain Alemany Arana")).toBeInTheDocument();
    expect(screen.getByText("911601")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/employees/employee-1/edit",
    );
  });
});
