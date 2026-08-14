import { EmployeeRequisitionDetail } from '@/components/employee/EmployeeWorkspace';

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeRequisitionDetail id={id} />;
}
