"use client";

import { useEffect, useState } from "react";

export type FuelEventSaveOutcome = "created" | "corrected";

const consumedStateKey = "namFuelEventResultConsumed";

export function FuelEventSaveConfirmation({ outcome }: { outcome: FuelEventSaveOutcome }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("result");
    const nextState = { ...(window.history.state ?? {}), [consumedStateKey]: true };
    window.history.replaceState(nextState, "", `${url.pathname}${url.search}${url.hash}`);
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted || window.history.state?.[consumedStateKey]) setVisible(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  if (!visible) return null;
  return (
    <div className="success-confirmation" role="status">
      <strong>{outcome === "created" ? "Fuel event saved successfully." : "Fuel event updated successfully."}</strong>
    </div>
  );
}
