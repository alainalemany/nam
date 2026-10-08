import { CurrentNextShiftCard, FleetAttentionCard, MaintenanceHealthCard, PayrollOverviewCard, QuickActionsCard } from "@/features/dashboard/HomeWidgets";
import { getHomeMaintenanceSummary } from "@/features/maintenance-tracking/data";
import { getPayrollPrincipal } from "@/features/payroll/auth";
import { getPayrollHomeSummary } from "@/features/payroll/data";
import { getHomeShiftSummary } from "@/features/work-schedule/home-summary";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ equipmentId?: string }> };

export default async function Home({ searchParams }: Props) {
  const [shift, query] = await Promise.all([getHomeShiftSummary(), searchParams]);
  let payroll;
  try {
    const principal = await getPayrollPrincipal();
    payroll = principal ? await getPayrollHomeSummary(principal.employeeId) : undefined;
  } catch {
    payroll = undefined;
  }
  const maintenance = await getHomeMaintenanceSummary({
    requestedEquipmentId: query?.equipmentId,
    scheduledEquipmentId: shift?.equipmentId,
  });

  return (
    <main className="page-stack page-stack--dashboard">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Operational overview</p>
        <h1 id="page-title">NAM Dashboard</h1>
        <p className="summary">
          Live context from the modules that own schedules, Equipment, and
          maintenance records.
        </p>
      </section>
      <div className="dashboard-grid">
        <CurrentNextShiftCard shift={shift} />
        <MaintenanceHealthCard items={maintenance.healthItems} equipment={maintenance.equipment} selectedEquipmentId={maintenance.selectedEquipmentId} selectedEquipmentLabel={maintenance.selectedEquipmentLabel} hiddenItemCount={maintenance.hiddenHealthItemCount} />
        <FleetAttentionCard items={maintenance.fleetAttention} />
        <PayrollOverviewCard summary={payroll} />
        <QuickActionsCard />
      </div>
    </main>
  );
}
