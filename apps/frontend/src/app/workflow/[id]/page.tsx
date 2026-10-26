import { InfraApp } from '@/components/infra-app';
export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InfraApp workflowId={id} />;
}
