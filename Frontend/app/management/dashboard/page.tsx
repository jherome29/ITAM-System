import { redirect } from 'next/navigation';

// The pre-redesign Management page carried hard-coded monthly and utilization
// figures. Management now lives at /management-audit; send anyone arriving here
// (an old bookmark, a typed address) to the maintained, real dashboard.
export default function ManagementDashboardPage() {
  redirect('/management-audit/dashboard');
}
