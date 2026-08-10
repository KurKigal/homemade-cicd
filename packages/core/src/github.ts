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