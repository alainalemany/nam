import { SupplyRequestCreateForm } from "@/features/supply-requests/SupplyRequestCreateForm";
import { supplyRequestRequester } from "@/features/supply-requests/server-config";
import { getSupplyRequestCreatePageData } from "@/features/supply-requests/surface-data";
import type { SupplyRequestCreateActionState } from "@/features/supply-requests/surface-types";
import { supplyRequestNewYorkWallClock } from "@/features/supply-requests/wall-clock";

export const dynamic = "force-dynamic";

export default async function NewSupplyRequestPage() {
  const [pageData, defaults] = await Promise.all([
    getSupplyRequestCreatePageData(),
    Promise.resolve(supplyRequestNewYorkWallClock()),
  ]);
  const initialState: SupplyRequestCreateActionState = {
    status: "idle",
    message: "",
    fieldErrors: {},
    values: {
      operationalWorkDate: defaults.date,
      submittedLocalDate: defaults.date,
      submittedLocalTime: defaults.time,
      equipmentId: "",
      supervisorId: "",
      notes: "",
      corporateSubmissionConfirmed: false,
    },
    items: [],
  };

  return (
    <main className="page-stack">
      <section className="page-header">
        <p className="eyebrow">Supply Requests</p>
        <h1>Record submitted Supply Request</h1>
        <p className="summary">
          Record a request only after it was successfully submitted through the
          corporate system. NAM does not submit the request.
        </p>
      </section>
      <SupplyRequestCreateForm
        defaults={defaults}
        initialState={initialState}
        pageData={pageData}
        requester={supplyRequestRequester}
      />
    </main>
  );
}
