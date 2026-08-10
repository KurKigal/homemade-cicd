import type {
  GitHubUser,
  Repository,
} from "@homemade-cicd/core";

import { github } from "../../lib/github.js";

import type {
  RepositoryReader,
} from "../../services/repositories/repository-reader.js";

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

interface WriteTextFileInput {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  message: string;
  content: string;
  sha?: string;
}

export class GitHubAdapter
  implements RepositoryReader
{
  async getAuthenticatedUser(): Promise<GitHubUser> {
    const { data } =
      await github.rest.users.getAuthenticated();

    return {
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      profileUrl: data.html_url,
    };
  }

  async listRepositories(): Promise<Repository[]> {
    const repositories = await github.paginate(
      github.rest.repos.listForAuthenticatedUser,
      {
        visibility: "all",
        affiliation:
          "owner,collaborator,organization_member",
        sort: "updated",
        direction: "desc",
        per_page: 100,
      },
    );

    return repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      url: repo.html_url,

      owner: {
        login: repo.owner.login,
        avatarUrl: repo.owner.avatar_url,
      },
    }));
  }

  async listRootEntryNames(
    owner: string,
    repo: string,
  ): Promise<Set<string>> {
    const { data } =
      await github.rest.repos.getContent({
        owner,
        repo,
        path: "",
      });

    if (!Array.isArray(data)) {
      throw new Error(
        "Repository root could not be inspected.",
      );
    }

    return new Set(
      data.map((entry) => entry.name),
    );
  }

  async readTextFile(
    owner: string,
    repo: string,
    path: string,
  ): Promise<string | null> {
    try {
      const { data } =
        await github.rest.repos.getContent({
          owner,
          repo,
          path,
        });

      if (
        Array.isArray(data) ||
        data.type !== "file"
      ) {
        return null;
      }

      if (
        !("content" in data) ||
        !data.content
      ) {
        return null;
      }

      return Buffer.from(
        data.content.replace(/\n/g, ""),
        "base64",
      ).toString("utf8");
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async pathExists(
    owner: string,
    repo: string,
    path: string,
  ): Promise<boolean> {
    try {
      await github.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      return true;
    } catch (error) {
      if (isNotFound(error)) {
        return false;
      }

      throw error;
    }
  }

  async getFileSha(
    owner: string,
    repo: string,
    path: string,
  ): Promise<string | undefined> {
    try {
      const { data } =
        await github.rest.repos.getContent({
          owner,
          repo,
          path,
        });

      if (
        Array.isArray(data) ||
        data.type !== "file"
      ) {
        return undefined;
      }

      return data.sha;
    } catch (error) {
      if (isNotFound(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async writeTextFile({
    owner,
    repo,
    path,
    branch,
    message,
    content,
    sha,
  }: WriteTextFileInput) {
    const response =
      await github.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        branch,
        message,

        content: Buffer.from(
          content,
          "utf8",
        ).toString("base64"),

        ...(sha
          ? {
              sha,
            }
          : {}),
      });

    return {
      commitSha:
        response.data.commit.sha,

      commitUrl:
        response.data.commit.html_url,
    };
  }
}

export const githubAdapter =
  new GitHubAdapter();