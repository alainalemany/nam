import { MaintenanceComponentForm } from "@/features/maintenance-tracking/MaintenanceComponentForm";

export default function NewMaintenanceComponentPage() {
  return <main className="page-stack"><section className="page-header"><p className="eyebrow">Reference data</p><h1>New Tracked Component</h1><p className="summary">Create a configurable maintenance item. Add one or more rules after saving it.</p></section><section className="panel form-stack"><MaintenanceComponentForm /></section></main>;
}
