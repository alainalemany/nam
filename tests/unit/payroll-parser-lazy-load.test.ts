import { describe, expect, it, vi } from "vitest";

const pdfModuleState = vi.hoisted(() => ({ initializations: 0 }));

vi.mock("@napi-rs/canvas", () => ({}));

vi.mock("pdf-parse", () => {
  pdfModuleState.initializations += 1;
  return {
    PDFParse: class {},
  };
});

describe("Payroll parser loading boundary", () => {
  it("does not initialize pdf-parse for ordinary text parsing", async () => {
    const { parseWorkdayPaycheckText } = await import("@/features/payroll/parser");

    expect(pdfModuleState.initializations).toBe(0);
    expect(
      parseWorkdayPaycheckText(`
        Pay Period Begin 09/21/2026
        Pay Period End 09/27/2026
        Check Date 10/02/2026
        REGULAR 40.00 33.15 1,326.00
        Gross Cash Pay 1,326.00
        Net Pay 1,000.00
      `).regularHours,
    ).toBe("40.00");
    expect(pdfModuleState.initializations).toBe(0);
  });
});
