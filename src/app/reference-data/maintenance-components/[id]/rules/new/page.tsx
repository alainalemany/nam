import { notFound } from "next/navigation";

import { getMaintenanceComponent } from "@/features/maintenance-tracking/data";
import { MaintenanceRuleForm } from "@/features/maintenance-tracking/MaintenanceRuleForm";

type Props = { params: Promise<{ id: string }> };

export default async function NewMaintenanceRulePage({ params }: Props) {
  const { id } = await params;
  const component = await getMaintenanceComponent(id);
  if (!component) notFound();
  return <main className="page-stack"><section className="page-header"><p className="eyebrow">{component.name}</p><h1>New Maintenance Rule</h1><p className="summary">Configure an exact threshold, service window, warning lead, repetition, and lifecycle effect.</p></section><section className="panel form-stack"><MaintenanceRuleForm componentId={component.id} /></section></main>;
}
