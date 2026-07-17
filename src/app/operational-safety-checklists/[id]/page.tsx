import Link from "next/link";
import { notFound } from "next/navigation";

import { safetyChecklistOptionLabel, safetyChecklistShiftOptions } from "@/features/operational-safety-checklists/constants";
import { displaySafetyChecklistDate, getOperationalSafetyChecklistById } from "@/features/operational-safety-checklists/data";
import { SafetyChecklistSaveConfirmation } from "@/features/operational-safety-checklists/SafetyChecklistSaveConfirmation";
import { verifySafetyChecklistResultMarker } from "@/features/operational-safety-checklists/result-marker";

type ChecklistDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ result?: string | string[] }>;
};

export default async function OperationalSafetyChecklistDetailPage({ params, searchParams }: ChecklistDetailPageProps) {
  const { id } = await params;
  const checklist = await getOperationalSafetyChecklistById(id);
  if (!checklist) notFound();
  const resultValue = (await searchParams)?.result;
  const result = verifySafetyChecklistResultMarker(
    typeof resultValue === "string" ? resultValue : undefined,
    checklist.id,
    checklist.recordVersion,
  );
  const needsRepair = checklist.responses.filter((response) => response.responseCode === "NEEDS_REPAIR").length;
  const previouslyNoted = checklist.responses.filter((response) => response.responseCode === "PREVIOUSLY_NOTED").length;
  const metadataResponses = checklist.responses.filter((response) => response.itemSection === "METADATA");
  const inspectionResponses = checklist.responses.filter((response) => response.itemSection === "INSPECTION");

  return (
    <main className="page-stack">
      {result ? (
        <SafetyChecklistSaveConfirmation checklistId={checklist.id} outcome={result} />
      ) : null}
      <section className="page-header with-actions">
        <div><p className="eyebrow">Completed · {checklist.templateName} V{checklist.templateVersion}</p><h1>{checklist.equipmentDisplayName}</h1><p className="summary">{displaySafetyChecklistDate(checklist.inspectionDate)} · {safetyChecklistOptionLabel(safetyChecklistShiftOptions, checklist.shift)} shift</p></div>
        <div className="inline-actions"><Link className="button secondary" href="/operational-safety-checklists">Back</Link><Link className="button primary" href={`/operational-safety-checklists/${id}/edit`}>Correct Checklist</Link></div>
      </section>

      <section className="panel table-panel">
        <div className="detail-grid full-width-field">
          <div><p className="eyebrow">Equipment number</p><p>{checklist.equipmentNumber ?? "Not recorded"}</p></div>
          <div><p className="eyebrow">Location</p><p>{checklist.mineName} · {checklist.cityName}{checklist.cityState ? `, ${checklist.cityState}` : ""}</p></div>
          <div><p className="eyebrow">Starting Meter Reading</p><p>{checklist.startingMeter} {checklist.meterKind === "HOURS" ? "Hours" : "Miles"}</p></div>
          <div><p className="eyebrow">Condition counts</p><p>{needsRepair} Needs Repair · {previouslyNoted} Previously Noted</p></div>
          <div><p className="eyebrow">Operator</p><p>{checklist.operatorDisplayName}</p></div>
          <div><p className="eyebrow">Supervisor</p><p>{checklist.supervisorDisplayName}</p></div>
          {metadataResponses.map((response) => <div key={response.id}><p className="eyebrow">{response.itemLabel}</p><p>{response.responseLabel}</p></div>)}
        </div>
      </section>

      <section className="panel table-panel" id="inspection-responses" aria-labelledby="responses-heading">
        <div className="section-heading"><h2 id="responses-heading">Inspection responses</h2><span className="count-pill">{inspectionResponses.length}</span></div>
        <div className="checklist-detail-responses">
          {inspectionResponses.map((response) => (
            <div className="checklist-detail-response" key={response.id}>
              <span>{response.itemLabel}{response.requiredMarker ? ` ${response.requiredMarker}` : ""}</span>
              <strong className={response.responseCode === "NEEDS_REPAIR" ? "response-warning" : response.responseCode === "PREVIOUSLY_NOTED" ? "response-noted" : ""}>{response.responseLabel}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel" aria-labelledby="problem-heading">
        <h2 id="problem-heading">Problem Description(s)</h2>
        <p>{checklist.problemDescription ?? "No problem description recorded."}</p>
      </section>
    </main>
  );
}
