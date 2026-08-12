import type {
  FlutterPipelineConfig,
  GitHubUser,
  PipelineApplyResult,
  PipelinePreview,
  Repository,
  RepositoryInspection,
  WorkflowArtifactsResponse,
  WorkflowCommandResult,
  WorkflowJobsResponse,
  WorkflowRunResponse,
  WorkflowRunsResponse,
  PipelineCommandResult,
  PipelineDetailsResponse,
  RepositoryWorkflowsResponse,
} from "@homemade-cicd/core";

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const message = await response
      .text()
      .catch(() => "");

    throw new Error(
      message ||
        `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  github: {
    me: () =>
      request<GitHubUser>("/api/github/me"),

    repositories: () =>
      request<Repository[]>(
        "/api/github/repos",
      ),

    inspectRepository: (
      owner: string,
      repo: string,
    ) =>
      request<RepositoryInspection>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/inspect`,
      ),

    previewFlutterPipeline: (
      owner: string,
      repo: string,
      config: FlutterPipelineConfig,
    ) =>
      request<PipelinePreview>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipeline/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        },
      ),

    applyFlutterPipeline: (
      owner: string,
      repo: string,
      config: FlutterPipelineConfig,
    ) =>
      request<PipelineApplyResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipeline`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        },
      ),

        workflowRuns: (
      owner: string,
      repo: string,
    ) =>
      request<WorkflowRunsResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs`,
      ),

    workflowRun: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowRunResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}`,
      ),

    workflowRunJobs: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowJobsResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}/jobs`,
      ),
    
    dispatchWorkflow: (
      owner: string,
      repo: string,
      ref: string,
    ) =>
      request<WorkflowCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/dispatch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ref,
          }),
        },
      ),

    rerunWorkflow: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}/rerun`,
        {
          method: "POST",
        },
      ),

    rerunFailedWorkflow: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}/rerun-failed`,
        {
          method: "POST",
        },
      ),

    cancelWorkflow: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}/cancel`,
        {
          method: "POST",
        },
      ),

    workflowRunArtifacts: (
      owner: string,
      repo: string,
      runId: number,
    ) =>
      request<WorkflowArtifactsResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${runId}/artifacts`,
      ),
    

    pipelines: (
      owner: string,
      repo: string,
    ) =>
      request<RepositoryWorkflowsResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipelines`,
      ),

    pipelineDetails: (
      owner: string,
      repo: string,
      workflowId: number,
    ) =>
      request<PipelineDetailsResponse>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipelines/${workflowId}`,
      ),

    enablePipeline: (
      owner: string,
      repo: string,
      workflowId: number,
    ) =>
      request<PipelineCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipelines/${workflowId}/enable`,
        {
          method: "POST",
        },
      ),

    disablePipeline: (
      owner: string,
      repo: string,
      workflowId: number,
    ) =>
      request<PipelineCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipelines/${workflowId}/disable`,
        {
          method: "POST",
        },
      ),

    deletePipeline: (
      owner: string,
      repo: string,
      workflowId: number,
    ) =>
      request<PipelineCommandResult>(
        `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pipelines/${workflowId}`,
        {
          method: "DELETE",
        },
      ),

  },
};