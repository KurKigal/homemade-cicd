import type {
  GitHubUser,
  ReleaseAsset,
  Repository,
  RepositoryRelease,
  WorkflowArtifact,
  WorkflowJob,
  WorkflowRun,
  RepositoryWorkflow,
} from "@homemade-cicd/core";

import {
  mapRepositoryWorkflow,
  mapWorkflowRun,
} from "./github-mappers.js";
import {
  mapReleaseAsset,
  mapRepositoryRelease,
  type GitHubReleaseAsset,
} from "./release-mappers.js";

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

const TAG_DEREFERENCE_LIMIT = 10;

export class GitHubTagResolutionError extends Error {
  constructor() {
    super(
      "The existing tag could not be resolved to a commit.",
    );
    this.name = "GitHubTagResolutionError";
  }
}

export type ArtifactTransferErrorCode =
  | "expired"
  | "invalid-download"
  | "invalid-upload"
  | "size"
  | "download"
  | "upload";

export class GitHubArtifactTransferError extends Error {
  readonly code: ArtifactTransferErrorCode;

  constructor(
    code: ArtifactTransferErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GitHubArtifactTransferError";
    this.code = code;
  }
}

export interface CreateRepositoryReleaseInput {
  tagName: string;
  targetCommitish: string;
  name?: string;
  body?: string;
  generateReleaseNotes: boolean;
  draft: boolean;
  prerelease: boolean;
}

export interface CreatedRepositoryRelease {
  release: RepositoryRelease;
  uploadUrl: string;
}

export interface WorkflowArtifactArchive {
  body: ReadableStream<Uint8Array>;
  contentLength: number;
}

function parseReleaseUploadUrl(
  uploadUrl: string,
  owner: string,
  repo: string,
  releaseId: number,
): string {
  const templateSuffix = "{?name,label}";

  if (!uploadUrl.endsWith(templateSuffix)) {
    throw new GitHubArtifactTransferError(
      "invalid-upload",
      "GitHub returned an invalid release upload URL.",
    );
  }

  let url: URL;

  try {
    url = new URL(
      uploadUrl.slice(0, -templateSuffix.length),
    );
  } catch {
    throw new GitHubArtifactTransferError(
      "invalid-upload",
      "GitHub returned an invalid release upload URL.",
    );
  }

  let pathParts: string[];

  try {
    pathParts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    throw new GitHubArtifactTransferError(
      "invalid-upload",
      "GitHub returned an invalid release upload URL.",
    );
  }

  const expectedParts = [
    "repos",
    owner,
    repo,
    "releases",
    String(releaseId),
    "assets",
  ];
  const matchesPath =
    pathParts.length === expectedParts.length &&
    pathParts.every((part, index) => {
      const expected = expectedParts[index];

      return expected !== undefined &&
        part.toLowerCase() === expected.toLowerCase();
    });

  if (
    url.protocol !== "https:" ||
    url.hostname !== "uploads.github.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    !matchesPath
  ) {
    throw new GitHubArtifactTransferError(
      "invalid-upload",
      "GitHub returned an invalid release upload URL.",
    );
  }

  return uploadUrl;
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

export interface RepositorySecretMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryActionsPublicKey {
  keyId: string;
  key: string;
}

export class GitHubAdapter
  implements RepositoryReader
{
  async listReleases(
    owner: string,
    repo: string,
  ): Promise<RepositoryRelease[]> {
    const releases: RepositoryRelease[] = [];
    let page = 1;

    while (true) {
      const { data } =
        await github.rest.repos.listReleases({
          owner,
          repo,
          per_page: 100,
          page,
        });

      releases.push(
        ...data.map(mapRepositoryRelease),
      );

      if (data.length < 100) {
        return releases;
      }

      page += 1;
    }
  }

  async getReleaseByTag(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<RepositoryRelease | null> {
    try {
      const { data } =
        await github.rest.repos.getReleaseByTag({
          owner,
          repo,
          tag: tagName,
        });

      return mapRepositoryRelease(data);
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }

    const releases = await this.listReleases(
      owner,
      repo,
    );

    return releases.find(
      (release) => release.tagName === tagName,
    ) ?? null;
  }

  async createRelease(
    owner: string,
    repo: string,
    input: CreateRepositoryReleaseInput,
  ): Promise<CreatedRepositoryRelease> {
    const { data } =
      await github.rest.repos.createRelease({
        owner,
        repo,
        tag_name: input.tagName,
        target_commitish: input.targetCommitish,
        ...(input.name !== undefined
          ? { name: input.name }
          : {}),
        ...(input.body !== undefined
          ? { body: input.body }
          : {}),
        generate_release_notes:
          input.generateReleaseNotes,
        draft: input.draft,
        prerelease: input.prerelease,
      });

    return {
      release: mapRepositoryRelease(data),
      uploadUrl: data.upload_url,
    };
  }

  async updateRelease(
    owner: string,
    repo: string,
    releaseId: number,
    draft: boolean,
  ): Promise<RepositoryRelease> {
    const { data } =
      await github.rest.repos.updateRelease({
        owner,
        repo,
        release_id: releaseId,
        draft,
      });

    return mapRepositoryRelease(data);
  }

  async createTagReference(
    owner: string,
    repo: string,
    tagName: string,
    commitSha: string,
  ): Promise<void> {
    await github.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${tagName}`,
      sha: commitSha,
    });
  }

  async resolveTagTargetCommit(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<string | null> {
    let target: {
      type: string;
      sha: string;
    };

    try {
      const { data } = await github.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${tagName}`,
      });

      target = data.object;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }

    const visited = new Set<string>();

    let dereferenceCount = 0;

    while (true) {
      if (
        target.type.trim() === "" ||
        target.sha.trim() === ""
      ) {
        throw new GitHubTagResolutionError();
      }

      if (target.type === "commit") {
        return target.sha;
      }

      if (
        target.type !== "tag" ||
        visited.has(target.sha)
      ) {
        throw new GitHubTagResolutionError();
      }

      if (
        dereferenceCount >= TAG_DEREFERENCE_LIMIT
      ) {
        throw new GitHubTagResolutionError();
      }

      visited.add(target.sha);
      dereferenceCount += 1;

      let data: {
        object: {
          type: string;
          sha: string;
        };
      };

      try {
        ({ data } = await github.rest.git.getTag({
          owner,
          repo,
          tag_sha: target.sha,
        }));
      } catch (error) {
        if (
          isNotFound(error) ||
          (
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            error.status === 409
          )
        ) {
          throw new GitHubTagResolutionError();
        }

        throw error;
      }

      target = data.object;
    }
  }

  async getBranchHeadCommit(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string> {
    const { data } = await github.rest.repos.getBranch({
      owner,
      repo,
      branch,
    });
    const commitSha = data.commit.sha;

    if (commitSha.trim() === "") {
      throw new Error(
        "The repository default branch head could not be resolved.",
      );
    }

    return commitSha;
  }

  async downloadWorkflowArtifactArchive(
    owner: string,
    repo: string,
    artifactId: number,
    expectedSize: number,
    maximumSize: number,
  ): Promise<WorkflowArtifactArchive> {
    if (
      !Number.isSafeInteger(expectedSize) ||
      expectedSize < 0 ||
      expectedSize > maximumSize
    ) {
      throw new GitHubArtifactTransferError(
        "size",
        "The selected artifact exceeds the release asset size limit.",
      );
    }

    const apiUrl =
      `https://api.github.com/repos/` +
      `${encodeURIComponent(owner)}/` +
      `${encodeURIComponent(repo)}/` +
      `actions/artifacts/${artifactId}/zip`;
    const redirectResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "manual",
    });

    if (redirectResponse.status === 410) {
      throw new GitHubArtifactTransferError(
        "expired",
        "The selected artifact expired before it could be downloaded.",
      );
    }

    if (redirectResponse.status !== 302) {
      throw new GitHubArtifactTransferError(
        "download",
        "GitHub could not prepare the selected artifact download.",
      );
    }

    const location =
      redirectResponse.headers.get("location");
    let downloadUrl: URL;

    try {
      downloadUrl = new URL(location ?? "");
    } catch {
      throw new GitHubArtifactTransferError(
        "invalid-download",
        "GitHub returned an invalid artifact download URL.",
      );
    }

    if (
      downloadUrl.protocol !== "https:" ||
      downloadUrl.username !== "" ||
      downloadUrl.password !== ""
    ) {
      throw new GitHubArtifactTransferError(
        "invalid-download",
        "GitHub returned an invalid artifact download URL.",
      );
    }

    let downloadResponse: Response;

    try {
      downloadResponse = await fetch(downloadUrl, {
        method: "GET",
        redirect: "error",
      });
    } catch {
      throw new GitHubArtifactTransferError(
        "download",
        "The selected artifact archive could not be downloaded.",
      );
    }

    if (downloadResponse.status === 410) {
      throw new GitHubArtifactTransferError(
        "expired",
        "The selected artifact expired before it could be downloaded.",
      );
    }

    if (!downloadResponse.ok) {
      throw new GitHubArtifactTransferError(
        "download",
        "The selected artifact archive could not be downloaded.",
      );
    }

    const contentLengthHeader =
      downloadResponse.headers.get("content-length");
    const contentLength = Number(contentLengthHeader);

    if (
      contentLengthHeader === null ||
      !/^(0|[1-9]\d*)$/.test(contentLengthHeader) ||
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength !== expectedSize ||
      contentLength > maximumSize
    ) {
      await downloadResponse.body?.cancel();
      throw new GitHubArtifactTransferError(
        "size",
        "The artifact archive size could not be verified safely.",
      );
    }

    if (!downloadResponse.body) {
      throw new GitHubArtifactTransferError(
        "download",
        "GitHub returned an empty artifact archive response.",
      );
    }

    let transferredBytes = 0;
    const boundedBody = downloadResponse.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          transferredBytes += chunk.byteLength;

          if (
            transferredBytes > contentLength ||
            transferredBytes > maximumSize
          ) {
            throw new GitHubArtifactTransferError(
              "size",
              "The artifact archive exceeded its verified length during transfer.",
            );
          }

          controller.enqueue(chunk);
        },
        flush() {
          if (transferredBytes !== contentLength) {
            throw new GitHubArtifactTransferError(
              "size",
              "The artifact archive length changed during transfer.",
            );
          }
        },
      }),
    );

    return {
      body: boundedBody,
      contentLength,
    };
  }

  async uploadReleaseAsset(
    owner: string,
    repo: string,
    releaseId: number,
    uploadUrl: string,
    assetName: string,
    archive: WorkflowArtifactArchive,
  ): Promise<ReleaseAsset> {
    let trustedUploadUrl: string;

    try {
      trustedUploadUrl = parseReleaseUploadUrl(
        uploadUrl,
        owner,
        repo,
        releaseId,
      );
    } catch (error) {
      await archive.body.cancel().catch(() => undefined);
      throw error;
    }

    try {
      const { data } =
        await github.request<GitHubReleaseAsset>(
          {
            method: "POST",
            url: trustedUploadUrl,
            name: assetName,
            headers: {
              accept: "application/vnd.github+json",
              "content-type": "application/zip",
              "content-length": String(
                archive.contentLength,
              ),
            },
            data: archive.body,
          },
        );

      return mapReleaseAsset(data);
    } catch (error) {
      if (error instanceof GitHubArtifactTransferError) {
        throw error;
      }

      throw new GitHubArtifactTransferError(
        "upload",
        "GitHub could not upload the selected release asset.",
      );
    }
  }

  async listRepositorySecrets(
    owner: string,
    repo: string,
  ): Promise<RepositorySecretMetadata[]> {
    const secrets: RepositorySecretMetadata[] = [];
    let page = 1;

    while (true) {
      const { data } =
        await github.rest.actions.listRepoSecrets({
        owner,
        repo,
        per_page: 100,
        page,
      });

      secrets.push(
        ...data.secrets.map((secret) => ({
          name: secret.name,
          createdAt: secret.created_at,
          updatedAt: secret.updated_at,
        })),
      );

      if (
        secrets.length >= data.total_count ||
        data.secrets.length === 0
      ) {
        return secrets;
      }

      page += 1;
    }
  }

  async getRepositoryActionsPublicKey(
    owner: string,
    repo: string,
  ): Promise<RepositoryActionsPublicKey> {
    const { data } =
      await github.rest.actions.getRepoPublicKey({
        owner,
        repo,
      });

    return {
      keyId: data.key_id,
      key: data.key,
    };
  }

  async createOrUpdateRepositorySecret(
    owner: string,
    repo: string,
    name: string,
    encryptedValue: string,
    keyId: string,
  ): Promise<void> {
    await github.rest.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: name,
      encrypted_value: encryptedValue,
      key_id: keyId,
    });
  }

  async deleteRepositorySecret(
    owner: string,
    repo: string,
    name: string,
  ): Promise<void> {
    try {
      await github.rest.actions.deleteRepoSecret({
        owner,
        repo,
        secret_name: name,
      });
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }

      throw error;
    }
  }

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
        mapWorkflowRun(run),
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

    return mapWorkflowRun(data);
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
    const artifacts: WorkflowArtifact[] = [];
    let totalCount = 0;
    let page = 1;

    while (true) {
      const { data } =
        await github.rest.actions.listWorkflowRunArtifacts({
          owner,
          repo,
          run_id: runId,
          per_page: 100,
          page,
        });

      totalCount = data.total_count;
      artifacts.push(
        ...data.artifacts.map((artifact) => {
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
      );

      if (
        artifacts.length >= totalCount ||
        data.artifacts.length === 0
      ) {
        return {
          totalCount,
          artifacts,
        };
      }

      page += 1;
    }
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
            mapRepositoryWorkflow(
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

    return mapRepositoryWorkflow(
      data,
    );
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
