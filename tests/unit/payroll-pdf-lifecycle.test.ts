import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfState = vi.hoisted(() => ({ mode: "success" as "success" | "parse-error" }));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    private readonly data: Uint8Array;

    constructor({ data }: { data: Uint8Array }) {
      this.data = data;
    }

    async getText() {
      const text = `
        Pay Period Begin 09/21/2026
        Pay Period End 09/27/2026
        Check Date 10/02/2026
        REGULAR 40.00 33.15 1,326.00
        Overtime 1X 20.00 33.15 663.00
        Overtime Premium - 0.5X 20.00 16.575 331.50
        Imputed GTL 1.15
        Imputed LTD 9.16
        Gross Cash Pay 2,320.50
        Net Pay 1,679.46
      `;
      structuredClone(this.data.buffer, { transfer: [this.data.buffer] });
      if (pdfState.mode === "parse-error") throw new Error("original parse failure");
      return { text };
    }

    async getTable() {
      return { mergedTables: [] };
    }

    async destroy() {
      throw new Error("cleanup failure");
    }
  },
}));

import { extractPaycheckPdf } from "@/features/payroll/parser";

function testPdf() {
  return new File(["%PDF-detached-buffer"], "test.pdf", { type: "application/pdf" });
}

describe("paycheck PDF buffer lifecycle", () => {
  beforeEach(() => {
    pdfState.mode = "success";
  });

  it("returns successful extraction when pdf-parse detaches its input and cleanup fails", async () => {
    await expect(extractPaycheckPdf(testPdf())).resolves.toMatchObject({
      periodStart: "2026-09-21",
      periodEnd: "2026-09-27",
      regularHours: "40.00",
      overtimeHours: "20.00",
      grossCashPay: "2320.50",
    });
  });

  it("preserves the original parse error when cleanup also fails", async () => {
    pdfState.mode = "parse-error";
    await expect(extractPaycheckPdf(testPdf())).rejects.toThrow("original parse failure");
  });
});
