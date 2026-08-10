import type {
  FlutterPipelineConfig,
  GitHubUser,
  PipelineApplyResult,
  PipelinePreview,
  Repository,
  RepositoryInspection,
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
  },
};