import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseWorkdayPaycheckText } from "@/features/payroll/parser";
import { workdayPaycheckTextFixtures as fixtures } from "../fixtures/workday-paycheck-text";

const hooks = vi.hoisted(() => ({ useActionState: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: hooks.useActionState,
  };
});
vi.mock("@/features/payroll/actions", () => ({
  correctPaycheckAction: vi.fn(),
  parsePaycheckAction: vi.fn(),
  saveManualPaycheckAction: vi.fn(),
  savePaycheckAction: vi.fn(),
}));

import { PaycheckReviewEditor } from "@/features/payroll/PayrollImportForm";

afterEach(cleanup);
beforeEach(() => {
  hooks.useActionState.mockReset();
  hooks.useActionState.mockImplementation((_action, initialState) => [initialState, vi.fn(), false]);
});

describe("Paycheck extraction review", () => {
  it("shows every conflicting observation and keeps rate entry review-only", () => {
    const initial = parseWorkdayPaycheckText(fixtures.multipleRegularRowsDifferentRatesWithoutDates);
    const { container } = render(<PaycheckReviewEditor initial={initial} />);

    expect(screen.getByText(/Row 1/).closest("li")).toHaveTextContent("hours 24.00; rate 33.15");
    expect(screen.getByText(/Row 2/).closest("li")).toHaveTextContent("hours 16.00; rate 35.25");
    expect(screen.getByText(/Hourly rate withheld/)).toBeInTheDocument();
    const rateInput = screen.getByLabelText("Base hourly rate (review only)");
    expect(rateInput).toBeEnabled();
    expect(rateInput).not.toBeRequired();
    expect(screen.getByText(/entered rate requires explicit evidence review/)).toBeInTheDocument();

    fireEvent.change(rateInput, { target: { value: "34.00" } });
    fireEvent.change(screen.getByLabelText("Regular earnings"), { target: { value: "1359.59" } });
    const payload = JSON.parse(
      (container.querySelector('input[name="payload"]') as HTMLInputElement).value,
    );
    expect(payload.rateExtraction.observations).toHaveLength(2);
    expect(payload.rateExtraction.observations.map((row: { hourlyRate: string }) => row.hourlyRate))
      .toEqual(["33.15", "35.25"]);
    expect(payload.baseRate).toBe("34.00");
  });

  it("keeps an ordinary supported import editable and warns when edits break the evidence match", () => {
    const initial = parseWorkdayPaycheckText(fixtures.ordinarySingleRate);
    render(<PaycheckReviewEditor initial={initial} />);

    expect(screen.getByLabelText("Base hourly rate")).toBeEnabled();
    expect(screen.queryByText(/Hourly rate withheld/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Base hourly rate"), { target: { value: "34.00" } });
    expect(screen.getByText(/Hourly rate withheld/)).toBeInTheDocument();
  });

  it("identifies an entered manual rate as non-verifying and review-required", () => {
    const initial = {
      ...parseWorkdayPaycheckText(fixtures.ordinarySingleRate),
      importMode: "MANUAL_ENTRY" as const,
      fingerprint: "",
      rateExtraction: undefined,
      baseRate: "",
    };
    render(<PaycheckReviewEditor initial={initial} />);

    expect(screen.getByText("Manual paycheck entry")).toBeInTheDocument();
    expect(screen.getByText(/do not establish verified hourly-rate evidence/)).toBeInTheDocument();
    expect(screen.getByLabelText("Base hourly rate")).toBeEnabled();
  });

  it("warns when a correction changes rate-relevant context", () => {
    const initial = {
      ...parseWorkdayPaycheckText(fixtures.ordinarySingleRate),
      importMode: "CORRECTION" as const,
      evidenceEnvelope: "synthetic-signed-envelope",
      rateExtraction: undefined,
    };
    render(<PaycheckReviewEditor initial={initial} paycheckId="paycheck-1" />);

    expect(screen.queryByText(/Rate review required/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Payroll period start"), { target: { value: "2026-09-15" } });
    expect(screen.getByText(/Rate review required/)).toBeInTheDocument();
  });

  it("links an authorized reviewer from saved uncertain evidence to rate history", () => {
    hooks.useActionState.mockReturnValueOnce([{
      status: "saved",
      message: "Review required.",
      paycheckId: "paycheck-1",
      rateEvidence: "NEEDS_REVIEW",
    }, vi.fn(), false]);
    render(<PaycheckReviewEditor initial={parseWorkdayPaycheckText(fixtures.ordinarySingleRate)} canReviewRateHistory />);
    expect(screen.getByText(/new or uncertain rate observation was retained/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Rate History" })).toHaveAttribute("href", "/payroll/rate-history");
  });

  it("highlights accounting fields, links to them, and clears the warning after correction", () => {
    const parsed = parseWorkdayPaycheckText(fixtures.pretaxSeptember28);
    const initial = {
      ...parsed,
      preTaxDeductions: "0.00",
      warnings: [...parsed.warnings, "Gross cash pay less parsed deductions and taxes does not equal net pay; review unclassified deductions."],
    };
    render(<PaycheckReviewEditor initial={initial} />);
    const field = screen.getByLabelText("Pre-tax deductions");
    expect(field).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Review Pre-tax deductions" }));
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "98.20" } });
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Gross cash pay less deductions and taxes does not equal net pay.")).not.toBeInTheDocument();
  });
});
