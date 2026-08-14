import type {
  GitHubUser,
  ManagedPipelineConfig,
  PipelineApplyResult,
  PipelineCommandResult,
  PipelineDetailsResponse,
  PipelinePreview,
  Repository,
  RepositoryInspection,
  RepositoryWorkflowsResponse,
  WorkflowArtifactsResponse,
  WorkflowCommandResult,
  WorkflowJobsResponse,
  WorkflowRunResponse,
  WorkflowRunsResponse,
} from "@homemade-cicd/core";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message || `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

function jsonRequest<T>(
  url: string,
  method: "POST" | "PUT",
  body?: unknown,
): Promise<T> {
  return request<T>(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}

function repositoryUrl(owner: string, repo: string, path = ""): string {
  return (
    `/api/github/repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}${path}`
  );
}

function runUrl(owner: string, repo: string, runId: number, path = "") {
  return repositoryUrl(owner, repo, `/runs/${runId}${path}`);
}

export const api = {
  github: {
    me: () => request<GitHubUser>("/api/github/me"),
    repositories: () => request<Repository[]>("/api/github/repos"),

    inspectRepository: (owner: string, repo: string) =>
      request<RepositoryInspection>(repositoryUrl(owner, repo, "/inspect")),

    previewPipeline: (
      owner: string,
      repo: string,
      config: ManagedPipelineConfig,
    ) =>
      jsonRequest<PipelinePreview>(
        repositoryUrl(owner, repo, "/pipeline/preview"),
        "POST",
        config,
      ),

    applyPipeline: (
      owner: string,
      repo: string,
      config: ManagedPipelineConfig,
    ) =>
      jsonRequest<PipelineApplyResult>(
        repositoryUrl(owner, repo, "/pipeline"),
        "PUT",
        config,
      ),

    workflowRuns: (owner: string, repo: string) =>
      request<WorkflowRunsResponse>(repositoryUrl(owner, repo, "/runs")),

    workflowRun: (owner: string, repo: string, runId: number) =>
      request<WorkflowRunResponse>(runUrl(owner, repo, runId)),

    workflowRunJobs: (owner: string, repo: string, runId: number) =>
      request<WorkflowJobsResponse>(runUrl(owner, repo, runId, "/jobs")),

    dispatchWorkflow: (owner: string, repo: string, ref: string) =>
      jsonRequest<WorkflowCommandResult>(
        repositoryUrl(owner, repo, "/runs/dispatch"),
        "POST",
        { ref },
      ),

    rerunWorkflow: (owner: string, repo: string, runId: number) =>
      jsonRequest<WorkflowCommandResult>(
        runUrl(owner, repo, runId, "/rerun"),
        "POST",
      ),

    rerunFailedWorkflow: (owner: string, repo: string, runId: number) =>
      jsonRequest<WorkflowCommandResult>(
        runUrl(owner, repo, runId, "/rerun-failed"),
        "POST",
      ),

    cancelWorkflow: (owner: string, repo: string, runId: number) =>
      jsonRequest<WorkflowCommandResult>(
        runUrl(owner, repo, runId, "/cancel"),
        "POST",
      ),

    workflowRunArtifacts: (owner: string, repo: string, runId: number) =>
      request<WorkflowArtifactsResponse>(
        runUrl(owner, repo, runId, "/artifacts"),
      ),

    pipelines: (owner: string, repo: string) =>
      request<RepositoryWorkflowsResponse>(
        repositoryUrl(owner, repo, "/pipelines"),
      ),

    pipelineDetails: (owner: string, repo: string, workflowId: number) =>
      request<PipelineDetailsResponse>(
        repositoryUrl(owner, repo, `/pipelines/${workflowId}`),
      ),

    enablePipeline: (owner: string, repo: string, workflowId: number) =>
      jsonRequest<PipelineCommandResult>(
        repositoryUrl(owner, repo, `/pipelines/${workflowId}/enable`),
        "POST",
      ),

    disablePipeline: (owner: string, repo: string, workflowId: number) =>
      jsonRequest<PipelineCommandResult>(
        repositoryUrl(owner, repo, `/pipelines/${workflowId}/disable`),
        "POST",
      ),

    deletePipeline: (owner: string, repo: string, workflowId: number) =>
      request<PipelineCommandResult>(
        repositoryUrl(owner, repo, `/pipelines/${workflowId}`),
        { method: "DELETE" },
      ),
  },
};
