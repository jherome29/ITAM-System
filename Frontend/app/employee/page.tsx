import { redirect } from 'next/navigation';

// Employee is the one workspace that isn't a [[...slug]] catch-all, so the
// bare /employee path (what the breadcrumb's root crumb always links to —
// see Breadcrumbs.tsx) had no page of its own and genuinely 404'd. Every
// other role's catch-all defaults a bare path to its dashboard; this matches
// that behaviour instead of leaving Employee as the one exception.
export default function EmployeeRootPage() {
  redirect('/employee/dashboard');
}
