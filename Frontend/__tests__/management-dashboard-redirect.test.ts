import { describe, expect, it } from 'vitest';
import ManagementDashboardPage from '@/app/management/dashboard/page';

// /management/dashboard was the pre-redesign Management page. It kept hard-coded
// "Monthly Requisition Trends" (Mar–Jun) and "Asset Utilization" figures and showed
// them as if they were real. Login sends Management to /management-audit now, but
// a bookmark or typed address still reached the old page — so it must not render
// anything of its own: it hands the visitor to the maintained dashboard.
describe('legacy /management/dashboard', () => {
  it('redirects to the real Management dashboard instead of rendering hard-coded charts', () => {
    let digest = '';
    try {
      ManagementDashboardPage();
    } catch (error) {
      digest = String((error as { digest?: string }).digest ?? '');
    }
    expect(digest).toContain('NEXT_REDIRECT');
    expect(digest).toContain('/management-audit/dashboard');
  });
});
