import type {
  GitHubUser,
  Repository,
  WorkflowArtifact,
  WorkflowJob,
  WorkflowRun,
  RepositoryWorkflow,
} from "@homemade-cicd/core";

import {
  env,
} from "../../config/env.js";

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
  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
  ): Promise<void> {
    await github.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowId,
      ref,
    });
  }

  async rerunWorkflow(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    await github.rest.actions.reRunWorkflow({
      owner,
      repo,
      run_id: runId,
    });
  }

  async rerunFailedWorkflowJobs(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    await github.rest.actions.reRunWorkflowFailedJobs({
      owner,
      repo,
      run_id: runId,
    });
  }

  async cancelWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    await github.rest.actions.cancelWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
  }
  async listWorkflowRuns(
    owner: string,
    repo: string,
    perPage = 30,
  ): Promise<{
    totalCount: number;
    runs: WorkflowRun[];
  }> {
    const { data } =
      await github.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: perPage,
      });

    return {
      totalCount: data.total_count,

      runs: data.workflow_runs.map((run) =>
        this.mapWorkflowRun(run),
      ),
    };
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<WorkflowRun> {
    const { data } =
      await github.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });

    return this.mapWorkflowRun(data);
  }

  async listWorkflowRunJobs(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<{
    totalCount: number;
    jobs: WorkflowJob[];
  }> {
    const { data } =
      await github.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
        filter: "latest",
        per_page: 100,
      });

    return {
      totalCount: data.total_count,

      jobs: data.jobs.map((job) => ({
        id: job.id,
        name: job.name,

        status: job.status,
        conclusion: job.conclusion,

        startedAt: job.started_at ?? null,
        completedAt: job.completed_at ?? null,

        htmlUrl: job.html_url ?? null,

        runnerName: job.runner_name ?? null,

        labels: job.labels,

        steps: (job.steps ?? []).map((step) => ({
          number: step.number,
          name: step.name,

          status: step.status,
          conclusion: step.conclusion,

          startedAt: step.started_at ?? null,
          completedAt: step.completed_at ?? null,
        })),
      })),
    };
  }
  
  async listWorkflowRunArtifacts(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<{
    totalCount: number;
    artifacts: WorkflowArtifact[];
  }> {
    const { data } =
      await github.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId,
        per_page: 100,
      });

    return {
      totalCount: data.total_count,

      artifacts: data.artifacts.map((artifact) => {
        const workflowRun =
          artifact.workflow_run &&
          artifact.workflow_run.id !== undefined &&
          artifact.workflow_run.head_sha
            ? {
                id: artifact.workflow_run.id,

                headBranch:
                  artifact.workflow_run
                    .head_branch ?? null,

                headSha:
                  artifact.workflow_run
                    .head_sha,
              }
            : null;

        return {
          id: artifact.id,

          name: artifact.name,

          sizeInBytes:
            artifact.size_in_bytes,

          expired: artifact.expired,

          createdAt:
            artifact.created_at ?? null,

          updatedAt:
            artifact.updated_at ?? null,

          expiresAt:
            artifact.expires_at ?? null,

          digest:
            artifact.digest ?? null,

          workflowRun,
        };
      }),
    };
  }

  async getArtifactDownloadUrl(
    owner: string,
    repo: string,
    artifactId: number,
  ): Promise<string> {
    const apiUrl =
      `https://api.github.com/repos/` +
      `${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}/` +
      `actions/artifacts/${artifactId}/zip`;

    const response = await fetch(
      apiUrl,
      {
        method: "GET",

        headers: {
          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${env.githubToken}`,

          "X-GitHub-Api-Version":
            "2022-11-28",
        },

        redirect: "manual",
      },
    );

    if (response.status === 410) {
      throw new Error(
        "Artifact has expired.",
      );
    }

    if (response.status !== 302) {
      throw new Error(
        `GitHub artifact download failed with status ${response.status}.`,
      );
    }

    const location =
      response.headers.get("location");

    if (!location) {
      throw new Error(
        "GitHub did not return an artifact download URL.",
      );
    }

    return location;
  }

  private mapWorkflowRun(
    run: Awaited<
      ReturnType<
        typeof github.rest.actions.getWorkflowRun
      >
    >["data"],
  ): WorkflowRun {
    return {
      id: run.id,

      workflowName:
        run.name ?? "GitHub Actions",

      displayTitle:
        run.display_title ??
        run.name ??
        "Workflow run",

      runNumber: run.run_number,

      attempt:
        run.run_attempt ?? 1,

      event: run.event,

      status: run.status ?? "unknown",

      conclusion:
        run.conclusion ?? null,

      headBranch:
        run.head_branch ?? null,

      headSha: run.head_sha,

      htmlUrl: run.html_url,

      createdAt: run.created_at,
      updatedAt: run.updated_at,

      startedAt:
        run.run_started_at ?? null,

      actor: run.actor
        ? {
            login: run.actor.login,
            avatarUrl:
              run.actor.avatar_url,
          }
        : null,
    };
  }

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
    ref?: string,
  ): Promise<string | null> {
    try {
      const { data } =
        await github.rest.repos.getContent({
          owner,
          repo,
          path,
              ...(ref
      ? {
          ref,
        }
      : {}),
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
    ref?: string,
  ): Promise<string | undefined> {
    try {
      const { data } =
        await github.rest.repos.getContent({
          owner,
          repo,
          path,
              ...(ref
      ? {
          ref,
        }
      : {}),
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

  async getRepositoryDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string> {
    const { data } =
      await github.rest.repos.get({
        owner,
        repo,
      });

    return data.default_branch;
  }

  async listRepositoryWorkflows(
    owner: string,
    repo: string,
  ): Promise<{
    totalCount: number;
    workflows: RepositoryWorkflow[];
  }> {
    const { data } =
      await github.rest.actions.listRepoWorkflows({
        owner,
        repo,
        per_page: 100,
      });

    return {
      totalCount:
        data.total_count,

      workflows:
        data.workflows.map(
          (workflow) =>
            this.mapRepositoryWorkflow(
              workflow,
            ),
        ),
    };
  }

  async getRepositoryWorkflow(
    owner: string,
    repo: string,
    workflowId: number,
  ): Promise<RepositoryWorkflow> {
    const { data } =
      await github.rest.actions.getWorkflow({
        owner,
        repo,
        workflow_id:
          workflowId,
      });

    return this.mapRepositoryWorkflow(
      data,
    );
  }


  private mapRepositoryWorkflow(
    workflow: {
      id: number;
      name: string;
      path: string;
      state: string;
      html_url: string;
      created_at: string;
      updated_at: string;
    },
  ): RepositoryWorkflow {
    return {
      id:
        workflow.id,

      name:
        workflow.name,

      path:
        workflow.path,

      state:
        workflow.state,

      htmlUrl:
        workflow.html_url,

      createdAt:
        workflow.created_at,

      updatedAt:
        workflow.updated_at,

      managedByHomemade:
        workflow.path ===
        ".github/workflows/homemade-ci.yml",
    };
  }

  async enableWorkflow(
    owner: string,
    repo: string,
    workflowId: number,
  ): Promise<void> {
    await github.rest.actions.enableWorkflow({
      owner,
      repo,

      workflow_id:
        workflowId,
    });
  }

  async disableWorkflow(
    owner: string,
    repo: string,
    workflowId: number,
  ): Promise<void> {
    await github.rest.actions.disableWorkflow({
      owner,
      repo,

      workflow_id:
        workflowId,
    });
  }

  async deleteTextFile({
    owner,
    repo,
    path,
    branch,
    message,
    sha,
  }: {
    owner: string;
    repo: string;
    path: string;
    branch: string;
    message: string;
    sha: string;
  }): Promise<{
    commitSha: string | null;
    commitUrl: string | null;
  }> {
    const response =
      await github.rest.repos.deleteFile({
        owner,
        repo,
        path,
        branch,
        message,
        sha,
      });

    return {
      commitSha:
        response.data.commit.sha ??
        null,

      commitUrl:
        response.data.commit
          .html_url ??
        null,
    };
  }

}

export const githubAdapter =
  new GitHubAdapter();