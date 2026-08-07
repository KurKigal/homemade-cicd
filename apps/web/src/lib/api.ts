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
    me: () => request<GitHubUser>("/api/github/me"),

    repositories: () =>
      request<Repository[]>("/api/github/repos"),
  },
};