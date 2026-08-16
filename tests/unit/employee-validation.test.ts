import { describe, expect, it } from "vitest";

import { employeeFormSchema } from "@/features/employees/validation";

describe("Employee validation", () => {
  it("requires a display name and keeps Employee Code optional", () => {
    expect(employeeFormSchema.safeParse({
      displayName: "   ",
      employeeCode: "",
      isActive: true,
      isSupervisor: false,
    }).success).toBe(false);

    expect(employeeFormSchema.parse({
      displayName: "  Alain   Alemany Arana  ",
      employeeCode: "   ",
      isActive: true,
      isSupervisor: false,
    })).toEqual({
      displayName: "Alain Alemany Arana",
      employeeCode: undefined,
      isActive: true,
      isSupervisor: false,
    });
  });

  it("preserves a supplied employee code without inventing one", () => {
    expect(employeeFormSchema.parse({
      displayName: "Alain Alemany Arana",
      employeeCode: " 911601 ",
      isActive: true,
      isSupervisor: false,
    }).employeeCode).toBe("911601");
  });
});
