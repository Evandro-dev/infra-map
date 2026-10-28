import type { Route } from 'next';

export type WorkflowListScope = 'overview' | 'personal';

/** A temporary URL id keeps an untouched workflow draft out of persistent storage. */
export function newWorkflowDraftPath(scope: WorkflowListScope): Route {
  const draftId = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  const query = new URLSearchParams({ uiContext: 'workflow_list', new: 'true' });
  if (scope === 'personal') query.set('scope', scope);
  return `/workflow/${draftId}?${query.toString()}` as Route;
}

/** Context is kept only for the creation visit; list links use the canonical path. */
export function workflowContextPath(id: string, scope: WorkflowListScope): Route {
  const query = new URLSearchParams({ uiContext: 'workflow_list' });
  if (scope === 'personal') query.set('scope', scope);
  return `/workflow/${encodeURIComponent(id)}?${query.toString()}` as Route;
}
