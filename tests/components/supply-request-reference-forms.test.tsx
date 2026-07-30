import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SupervisorReferenceForm,
  SupplyItemReferenceForm,
} from "@/features/supply-requests/ReferenceForms";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      {
        ...initialState,
        status: "error",
        message: "Check the reference details before saving.",
        fieldErrors: {
          itemNumber: ["A Supply Item with this Item Number already exists."],
          email: ["A supervisor with this email already exists."],
        },
        values: {
          itemNumber: " AB-12 ",
          description: "Submitted description",
          unitOfMeasure: "Submitted unit",
          fullName: "Submitted Supervisor",
          email: "Submitted@Example.com",
        },
      },
      vi.fn(),
      false,
    ]),
  };
});

afterEach(cleanup);

describe("Supply Request reference forms", () => {
  it("renders field errors and preserves submitted Supply Item values", () => {
    render(<SupplyItemReferenceForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check the reference details before saving.",
    );
    expect(screen.getByLabelText("Item Number")).toHaveValue(" AB-12 ");
    expect(screen.getByLabelText("Item Number")).toHaveAttribute(
      "aria-describedby",
      "supply-item-number-error",
    );
    expect(screen.getByLabelText("Item Number")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Submitted description",
    );
    expect(screen.getByLabelText("Description")).not.toHaveAttribute(
      "aria-describedby",
    );
    expect(screen.getByLabelText("Unit")).toHaveValue("Submitted unit");
    expect(
      screen.getByText("A Supply Item with this Item Number already exists."),
    ).toBeInTheDocument();
  });

  it("renders supervisor uniqueness errors and preserves submitted values", () => {
    render(<SupervisorReferenceForm />);

    expect(screen.getByLabelText("Full name")).toHaveValue(
      "Submitted Supervisor",
    );
    expect(screen.getByLabelText("Email")).toHaveValue(
      "Submitted@Example.com",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-describedby",
      "supervisor-email-error",
    );
    expect(
      screen.getByText("A supervisor with this email already exists."),
    ).toBeInTheDocument();
  });
});
