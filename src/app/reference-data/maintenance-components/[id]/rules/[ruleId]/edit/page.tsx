import { notFound } from "next/navigation";

import { getMaintenanceRule } from "@/features/maintenance-tracking/data";
import { MaintenanceRuleForm } from "@/features/maintenance-tracking/MaintenanceRuleForm";

type Props = { params: Promise<{ id: string; ruleId: string }> };

export default async function EditMaintenanceRulePage({ params }: Props) {
  const { id, ruleId } = await params;
  const rule = await getMaintenanceRule(ruleId);
  if (!rule || rule.componentId !== id) notFound();
  return <main className="page-stack"><section className="page-header"><p className="eyebrow">{rule.component.name}</p><h1>Edit {rule.actionName}</h1><p className="summary">Changes affect current status calculations while retained service events keep their historical rule snapshots.</p></section><section className="panel form-stack"><MaintenanceRuleForm componentId={id} id={rule.id} initial={{ actionName: rule.actionName, counterScope: rule.counterScope, thresholdValue: rule.thresholdValue.toString(), upperThresholdValue: rule.upperThresholdValue?.toString() ?? null, repeatable: rule.repeatable, repeatIntervalValue: rule.repeatIntervalValue?.toString() ?? null, maximumRepeatCount: rule.maximumRepeatCount, warningLeadValue: rule.warningLeadValue?.toString() ?? null, startsNewLifecycle: rule.startsNewLifecycle, active: rule.active, priority: rule.priority, sortOrder: rule.sortOrder }} /></section></main>;
}
