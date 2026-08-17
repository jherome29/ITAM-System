import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { ActivityTable } from '@/components/dashboard/ActivityTable';
import { BarChart } from '@/components/dashboard/BarChart';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { DonutChart } from '@/components/dashboard/DonutChart';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LineChart } from '@/components/dashboard/LineChart';
import { PermissionGate } from '@/components/shell/PermissionGate';
import { getDashboardMockData } from '@/lib/mock/dashboard.mock';
import { ProposedUserRole, proposedRoleLabels } from '@/lib/roles/proposed-roles';
import { Plus } from 'lucide-react';
import Link from 'next/link';

function secondaryActivityTitle(isEmployee: boolean, isReadOnly: boolean) {
  if (isEmployee) return 'Upcoming Actions';
  if (isReadOnly) return 'Read-Only Audit Highlights';
  return 'Awaiting Approval';
}

export function RoleDashboard({ role }: { role: ProposedUserRole }) {
  const data = getDashboardMockData(role);
  const isReadOnly = role === ProposedUserRole.MANAGEMENT_AUDIT_VIEWER;
  const isEmployee = role === ProposedUserRole.EMPLOYEE;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-blue-700">{proposedRoleLabels[role]}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Overview</h1>
          <p className="mt-1 text-sm text-slate-600">Key activity, serviceability, and work requiring your attention.</p>
        </div>
        <PermissionGate role={role} permission="create_requisition">
          <Link href="/employee/requisitions/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-800"><Plus className="h-4 w-4" />New requisition</Link>
        </PermissionGate>
      </div>

      <AlertBanner message={data.alert} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((metric, index) => <KpiCard key={metric.label} metric={metric} index={index} />)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartCard
          title={isEmployee ? 'My Requisition Activity' : 'Requisition & Issuance Activity'}
          subtitle={isEmployee ? 'Requests submitted, approved, issued, and rejected' : 'January - June 2025'}
          action={<select aria-label="Reporting year" className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"><option>CY 2025</option></select>}
        >
          <LineChart data={data.trends} />
        </ChartCard>
        <ChartCard title={isEmployee ? 'My Assigned Asset Condition' : 'Asset Condition'} subtitle={isEmployee ? 'Only assets assigned to you' : 'Current serviceability status'}>
          <DonutChart data={data.conditions} />
        </ChartCard>
      </div>

      <ChartCard title={isEmployee ? 'My Assigned Assets by Type' : 'Asset Value by Category'} subtitle={isEmployee ? 'Counts of assigned asset types' : 'Acquisition cost in PHP thousands'}>
        <BarChart data={data.categoryValues} />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Recent Requisitions" action={<span className="text-xs font-bold text-blue-700">View All</span>}>
          <ActivityTable rows={data.recentRequisitions} />
        </ChartCard>
        <ChartCard title={secondaryActivityTitle(isEmployee, isReadOnly)}>
          <ActivityTable rows={isReadOnly ? data.auditActivity : data.awaitingApproval} />
        </ChartCard>
      </div>

      {!isEmployee && (
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard title="Recent Asset Movements">
            <ActivityTable rows={data.recentMovements} />
          </ChartCard>
          <ChartCard title="Inventory Discrepancies">
            <ActivityTable rows={data.inventoryDiscrepancies} />
          </ChartCard>
          <ChartCard title="Useful-Life Alerts">
            <ActivityTable rows={data.usefulLifeAlerts} />
          </ChartCard>
        </div>
      )}

    </div>
  );
}
