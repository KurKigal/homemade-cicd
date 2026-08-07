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

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
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
  },
};