import {
  HOMEMADE_WORKFLOW_PATH,
  type RepositoryWorkflow,
  type WorkflowRun,
} from "@homemade-cicd/core";

interface GitHubWorkflowRun {
  id: number;
  name?: string | null;
  display_title?: string | null;
  run_number: number;
  run_attempt?: number | null;
  event: string;
  status?: string | null;
  conclusion?: string | null;
  head_branch?: string | null;
  head_sha: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string | null;
  actor?: {
    login: string;
    avatar_url: string;
  } | null;
}

interface GitHubRepositoryWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export function mapWorkflowRun(run: GitHubWorkflowRun): WorkflowRun {
  return {
    id: run.id,
    workflowName: run.name ?? "GitHub Actions",
    displayTitle: run.display_title ?? run.name ?? "Workflow run",
    runNumber: run.run_number,
    attempt: run.run_attempt ?? 1,
    event: run.event,
    status: run.status ?? "unknown",
    conclusion: run.conclusion ?? null,
    headBranch: run.head_branch ?? null,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    startedAt: run.run_started_at ?? null,
    actor: run.actor
      ? {
          login: run.actor.login,
          avatarUrl: run.actor.avatar_url,
        }
      : null,
  };
}

export function mapRepositoryWorkflow(
  workflow: GitHubRepositoryWorkflow,
): RepositoryWorkflow {
  return {
    id: workflow.id,
    name: workflow.name,
    path: workflow.path,
    state: workflow.state,
    htmlUrl: workflow.html_url,
    createdAt: workflow.created_at,
    updatedAt: workflow.updated_at,
    managedByHomemade: workflow.path === HOMEMADE_WORKFLOW_PATH,
  };
}
