import { getMaintenanceTrackerOptions } from "@/features/maintenance-tracking/data";
import { MaintenanceTrackerForm } from "@/features/maintenance-tracking/MaintenanceTrackerForm";
import { localDateTimeInputParts } from "@/lib/zoned-date-time";

export const dynamic = "force-dynamic";

export default async function NewMaintenanceTrackerPage() {
  const options = await getMaintenanceTrackerOptions();
  const defaults = localDateTimeInputParts();
  return <main className="page-stack"><section className="page-header"><p className="eyebrow">Maintenance tracking</p><h1>Track an Equipment Component</h1><p className="summary">Create one Equipment-specific tracker. Completed DDR runtime supplies its operating hours.</p></section><section className="panel form-stack"><MaintenanceTrackerForm {...options} defaultDate={defaults.date} defaultTime={defaults.time} /></section></main>;
}
