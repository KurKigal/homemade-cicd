import type {
  AndroidSigningCredentialsRequest,
  GitHubUser,
  IosSigningCredentialsRequest,
  ManagedPipelineConfig,
  PipelineApplyResult,
  PipelineCommandResult,
  PipelineDetailsResponse,
  PipelinePreview,
  Repository,
  RepositoryInspection,
  RepositorySigningStatus,
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
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed: ${response.status} ${response.statusText}`;
  const body = await response.text().catch(() => "");

  if (!body) {
    return fallback;
  }

  try {
    const payload: unknown = JSON.parse(body);

    if (typeof payload === "object" && payload !== null) {
      if ("error" in payload && typeof payload.error === "string") {
        return payload.error;
      }

      if ("message" in payload && typeof payload.message === "string") {
        return payload.message;
      }
    }
  } catch {
    return body;
  }

  return fallback;
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

    signingStatus: (owner: string, repo: string) =>
      request<RepositorySigningStatus>(
        repositoryUrl(owner, repo, "/signing"),
      ),

    saveAndroidSigningCredentials: (
      owner: string,
      repo: string,
      credentials: AndroidSigningCredentialsRequest,
    ) =>
      jsonRequest<RepositorySigningStatus>(
        repositoryUrl(owner, repo, "/signing/android"),
        "PUT",
        credentials,
      ),

    deleteAndroidSigningCredentials: (owner: string, repo: string) =>
      request<RepositorySigningStatus>(
        repositoryUrl(owner, repo, "/signing/android"),
        { method: "DELETE" },
      ),

    saveIosSigningCredentials: (
      owner: string,
      repo: string,
      credentials: IosSigningCredentialsRequest,
    ) =>
      jsonRequest<RepositorySigningStatus>(
        repositoryUrl(owner, repo, "/signing/ios"),
        "PUT",
        credentials,
      ),

    deleteIosSigningCredentials: (owner: string, repo: string) =>
      request<RepositorySigningStatus>(
        repositoryUrl(owner, repo, "/signing/ios"),
        { method: "DELETE" },
      ),

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
