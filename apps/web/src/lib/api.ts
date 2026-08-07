export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
}

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  updatedAt: string | null;
  url: string;
  owner: {
    login: string;
    avatarUrl: string;
  };
}

export interface ProjectAnalysis {
  projectType:
    | "flutter"
    | "node"
    | "python"
    | "unknown";

  framework: string | null;
  language: string | null;

  packageManager:
    | "pnpm"
    | "npm"
    | "yarn"
    | "bun"
    | null;

  platforms: {
    android: boolean;
    ios: boolean;
    web: boolean;
  };

  ciConfigured: boolean;
  signals: string[];
}

export interface RepositoryInspection {
  repository: {
    owner: string;
    name: string;
  };

  analysis: ProjectAnalysis;
}

export interface FlutterPipelineConfig {
  branch: string;

  trigger: {
    push: boolean;
    pullRequest: boolean;
    manual: boolean;
  };

  checks: {
    analyze: boolean;
    test: boolean;
  };

  android: {
    enabled: boolean;
    apk: boolean;
    aab: boolean;
  };

  ios: {
    enabled: boolean;
    unsignedBuild: boolean;
  };
}

export interface PipelinePreview {
  repository: {
    owner: string;
    repo: string;
  };

  yaml: string;
}

export interface PipelineApplyResult {
  success: boolean;

  workflow: {
    path: string;
    commitSha: string;
    commitUrl: string | null;
    created: boolean;
  };
}

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