import { EmployeeWorkspace } from '@/components/employee/EmployeeWorkspace';

export default async function EmployeeReturnsIncidentsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ open?: string | string[] }> }>) {
  const { open } = await searchParams;
  return <EmployeeWorkspace slug="returns-incidents" openId={typeof open === 'string' ? open : undefined} />;
}
