import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseWorkdayPaycheckText } from "@/features/payroll/parser";
import { workdayPaycheckTextFixtures as fixtures } from "../fixtures/workday-paycheck-text";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [initialState, vi.fn(), false]),
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

describe("Paycheck extraction review", () => {
  it("shows every conflicting observation and prevents authoritative rate entry", () => {
    const initial = parseWorkdayPaycheckText(fixtures.multipleRegularRowsDifferentRatesWithoutDates);
    const { container } = render(<PaycheckReviewEditor initial={initial} />);

    expect(screen.getByText(/Row 1/).closest("li")).toHaveTextContent("hours 24.00; rate 33.15");
    expect(screen.getByText(/Row 2/).closest("li")).toHaveTextContent("hours 16.00; rate 35.25");
    expect(screen.getByText(/Hourly rate withheld/)).toBeInTheDocument();
    expect(screen.getByLabelText("Base hourly rate")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Regular earnings"), { target: { value: "1359.59" } });
    const payload = JSON.parse(
      (container.querySelector('input[name="payload"]') as HTMLInputElement).value,
    );
    expect(payload.rateExtraction.observations).toHaveLength(2);
    expect(payload.rateExtraction.observations.map((row: { hourlyRate: string }) => row.hourlyRate))
      .toEqual(["33.15", "35.25"]);
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
});
