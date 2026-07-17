"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { SafetyChecklistResultOutcome } from "./result-marker";

type SafetyChecklistSaveConfirmationProps = {
  checklistId: string;
  outcome: SafetyChecklistResultOutcome;
};

const consumedStateKey = "namSafetyChecklistResultConsumed";

export function SafetyChecklistSaveConfirmation({
  checklistId,
  outcome,
}: SafetyChecklistSaveConfirmationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("result");
    const nextState = {
      ...(window.history.state ?? {}),
      [consumedStateKey]: true,
    };
    window.history.replaceState(nextState, "", `${url.pathname}${url.search}${url.hash}`);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted || window.history.state?.[consumedStateKey]) {
        setVisible(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  if (!visible) return null;

  return (
    <section
      className="success-confirmation"
      data-checklist-result={outcome}
      role="status"
    >
      <div>
        <strong>
          {outcome === "created"
            ? "Checklist saved in NAM Dashboard."
            : "Checklist correction saved in NAM Dashboard."}
        </strong>
        <p>The completed NAM record is ready to review.</p>
      </div>
      <div className="inline-actions">
        <a className="button secondary" href="#inspection-responses">
          View Inspection
        </a>
        <Link
          className="button primary"
          href={`/operational-safety-checklists/new?from=${encodeURIComponent(checklistId)}`}
        >
          Create Another Inspection
        </Link>
      </div>
    </section>
  );
}
