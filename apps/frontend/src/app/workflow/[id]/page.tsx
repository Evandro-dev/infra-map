import { InfraApp } from '@/components/infra-app';
export default async function WorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isDraft = query.new === 'true';
  return (
    <InfraApp
      key={isDraft ? `draft:${id}` : 'persisted-workflow'}
      workflowId={id}
      isDraft={isDraft}
      workflowScope={query.scope === 'personal' ? 'personal' : 'overview'}
    />
  );
}
