import type {
  CreateReleaseRequest,
  CreateReleaseResult,
  FailedReleaseArtifact,
  ReleaseAsset,
  RepositoryRelease,
  WorkflowArtifact,
  WorkflowRun,
} from "@homemade-cicd/core";
import {
  RELEASE_ARTIFACT_MAX_BYTES,
} from "@homemade-cicd/core";

import {
  GitHubArtifactTransferError,
  GitHubTagResolutionError,
  githubAdapter,
  type CreateRepositoryReleaseInput,
  type CreatedRepositoryRelease,
  type WorkflowArtifactArchive,
} from "../../adapters/github/github-adapter.js";

export interface ReleaseRepositoryGateway {
  listReleases(
    owner: string,
    repo: string,
  ): Promise<RepositoryRelease[]>;

  getReleaseByTag(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<RepositoryRelease | null>;

  createRelease(
    owner: string,
    repo: string,
    input: CreateRepositoryReleaseInput,
  ): Promise<CreatedRepositoryRelease>;

  updateRelease(
    owner: string,
    repo: string,
    releaseId: number,
    draft: boolean,
  ): Promise<RepositoryRelease>;

  createTagReference(
    owner: string,
    repo: string,
    tagName: string,
    commitSha: string,
  ): Promise<void>;

  resolveTagTargetCommit(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<string | null>;

  getRepositoryDefaultBranch(
    owner: string,
    repo: string,
  ): Promise<string>;

  getBranchHeadCommit(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string>;

  getWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<WorkflowRun>;

  listWorkflowRunArtifacts(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<{
    totalCount: number;
    artifacts: WorkflowArtifact[];
  }>;

  downloadWorkflowArtifactArchive(
    owner: string,
    repo: string,
    artifactId: number,
    expectedSize: number,
    maximumSize: number,
  ): Promise<WorkflowArtifactArchive>;

  uploadReleaseAsset(
    owner: string,
    repo: string,
    releaseId: number,
    uploadUrl: string,
    assetName: string,
    archive: WorkflowArtifactArchive,
  ): Promise<ReleaseAsset>;
}

type GitHubOperation =
  | "read-releases"
  | "write-release"
  | "read-run"
  | "read-artifacts";

export class ReleaseServiceError extends Error {
  readonly statusCode: number;

  constructor(
    message: string,
    statusCode: number,
  ) {
    super(message);
    this.name = "ReleaseServiceError";
    this.statusCode = statusCode;
  }
}

function readHttpStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return null;
}

function normalizeGitHubError(
  error: unknown,
  operation: GitHubOperation,
): ReleaseServiceError {
  if (error instanceof ReleaseServiceError) {
    return error;
  }

  if (error instanceof GitHubTagResolutionError) {
    return new ReleaseServiceError(
      error.message,
      409,
    );
  }

  const status = readHttpStatus(error);

  if (status === 401) {
    return new ReleaseServiceError(
      "GitHub authentication failed. Verify the configured token.",
      401,
    );
  }

  if (status === 403) {
    if (
      operation === "read-run" ||
      operation === "read-artifacts"
    ) {
      return new ReleaseServiceError(
        "GitHub Actions read permission is required to use workflow runs and artifacts as a release source.",
        403,
      );
    }

    if (operation === "write-release") {
      return new ReleaseServiceError(
        "GitHub Contents write permission is required to create and publish releases.",
        403,
      );
    }

    return new ReleaseServiceError(
      "GitHub Contents read permission is required to list releases.",
      403,
    );
  }

  if (status === 404) {
    if (operation === "read-run") {
      return new ReleaseServiceError(
        "The selected workflow run could not be found.",
        404,
      );
    }

    return new ReleaseServiceError(
      "The repository or requested GitHub resource could not be found.",
      404,
    );
  }

  if (status === 409) {
    return new ReleaseServiceError(
      "GitHub could not complete the release operation because the repository state changed.",
      409,
    );
  }

  if (status === 422) {
    return new ReleaseServiceError(
      "GitHub rejected the release tag or release fields. Check the tag and try again.",
      422,
    );
  }

  return new ReleaseServiceError(
    operation === "read-releases"
      ? "GitHub releases could not be read."
      : "The GitHub release operation failed.",
    502,
  );
}

function sameCommit(
  first: string,
  second: string,
): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function sanitizeArtifactBaseName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .replace(/\.zip$/i, "")
    .slice(0, 180)
    .replace(/[.-]+$/g, "");

  return normalized || "artifact";
}

export function buildReleaseAssetNames(
  artifacts: readonly WorkflowArtifact[],
): Map<number, string> {
  const names = new Map<number, string>();
  const used = new Set<string>();

  for (const artifact of artifacts) {
    const baseName = sanitizeArtifactBaseName(
      artifact.name,
    );
    let assetName = `${baseName}.zip`;

    if (used.has(assetName.toLowerCase())) {
      assetName = `${baseName}-${artifact.id}.zip`;

      let collisionIndex = 2;

      while (used.has(assetName.toLowerCase())) {
        assetName =
          `${baseName}-${artifact.id}-${collisionIndex}.zip`;
        collisionIndex += 1;
      }
    }

    used.add(assetName.toLowerCase());
    names.set(artifact.id, assetName);
  }

  return names;
}

function mergeReleaseAssets(
  release: RepositoryRelease,
  uploadedAssets: readonly ReleaseAsset[],
): RepositoryRelease {
  const assetsById = new Map(
    release.assets.map((asset) => [asset.id, asset]),
  );

  for (const asset of uploadedAssets) {
    assetsById.set(asset.id, asset);
  }

  return {
    ...release,
    assets: [...assetsById.values()],
  };
}

function artifactTransferMessage(error: unknown): string {
  if (error instanceof GitHubArtifactTransferError) {
    return error.message;
  }

  return "The artifact could not be attached to the draft release.";
}

export function createReleaseService(
  gateway: ReleaseRepositoryGateway,
) {
  async function listRepositoryReleases(
    owner: string,
    repo: string,
  ): Promise<RepositoryRelease[]> {
    try {
      return await gateway.listReleases(owner, repo);
    } catch (error) {
      throw normalizeGitHubError(
        error,
        "read-releases",
      );
    }
  }

  async function assertReleaseDoesNotExist(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<void> {
    let release: RepositoryRelease | null;

    try {
      release = await gateway.getReleaseByTag(
        owner,
        repo,
        tagName,
      );
    } catch (error) {
      throw normalizeGitHubError(
        error,
        "read-releases",
      );
    }

    if (release) {
      throw new ReleaseServiceError(
        `A release already exists for tag ${tagName}.`,
        409,
      );
    }
  }

  async function readTagTarget(
    owner: string,
    repo: string,
    tagName: string,
  ): Promise<string | null> {
    try {
      return await gateway.resolveTagTargetCommit(
        owner,
        repo,
        tagName,
      );
    } catch (error) {
      throw normalizeGitHubError(
        error,
        "read-releases",
      );
    }
  }

  async function ensureWorkflowTag(
    owner: string,
    repo: string,
    tagName: string,
    commitSha: string,
  ): Promise<void> {
    const existingTarget = await readTagTarget(
      owner,
      repo,
      tagName,
    );

    if (existingTarget !== null) {
      if (!sameCommit(existingTarget, commitSha)) {
        throw new ReleaseServiceError(
          "Existing tag points to a different commit.",
          409,
        );
      }

      return;
    }

    try {
      await gateway.createTagReference(
        owner,
        repo,
        tagName,
        commitSha,
      );
    } catch (error) {
      const status = readHttpStatus(error);

      if (status === 409 || status === 422) {
        const racedTarget = await readTagTarget(
          owner,
          repo,
          tagName,
        );

        if (
          racedTarget !== null &&
          sameCommit(racedTarget, commitSha)
        ) {
          return;
        }

        if (racedTarget !== null) {
          throw new ReleaseServiceError(
            "Existing tag points to a different commit.",
            409,
          );
        }
      }

      throw normalizeGitHubError(
        error,
        "write-release",
      );
    }

    const createdTarget = await readTagTarget(
      owner,
      repo,
      tagName,
    );

    if (
      createdTarget === null ||
      !sameCommit(createdTarget, commitSha)
    ) {
      throw new ReleaseServiceError(
        "The release tag could not be verified at the selected workflow commit.",
        409,
      );
    }
  }

  async function validateWorkflowSource(
    owner: string,
    repo: string,
    runId: number,
    artifactIds: readonly number[],
  ): Promise<{
    targetCommitish: string;
    artifacts: WorkflowArtifact[];
  }> {
    let run: WorkflowRun;

    try {
      run = await gateway.getWorkflowRun(
        owner,
        repo,
        runId,
      );
    } catch (error) {
      throw normalizeGitHubError(error, "read-run");
    }

    if (
      run.status !== "completed" ||
      run.conclusion !== "success"
    ) {
      throw new ReleaseServiceError(
        "Selected workflow run did not succeed.",
        409,
      );
    }

    if (artifactIds.length === 0) {
      return {
        targetCommitish: run.headSha,
        artifacts: [],
      };
    }

    let available: WorkflowArtifact[];

    try {
      ({ artifacts: available } =
        await gateway.listWorkflowRunArtifacts(
          owner,
          repo,
          runId,
        ));
    } catch (error) {
      throw normalizeGitHubError(
        error,
        "read-artifacts",
      );
    }

    const byId = new Map(
      available.map((artifact) => [artifact.id, artifact]),
    );
    const selected: WorkflowArtifact[] = [];

    for (const artifactId of artifactIds) {
      const artifact = byId.get(artifactId);

      if (!artifact) {
        throw new ReleaseServiceError(
          "Selected artifact does not belong to this workflow run.",
          404,
        );
      }

      if (
        artifact.workflowRun !== null &&
        (
          artifact.workflowRun.id !== runId ||
          !sameCommit(
            artifact.workflowRun.headSha,
            run.headSha,
          )
        )
      ) {
        throw new ReleaseServiceError(
          "Selected artifact does not belong to this workflow run.",
          404,
        );
      }

      if (artifact.expired) {
        throw new ReleaseServiceError(
          "Selected artifact has expired.",
          409,
        );
      }

      if (
        artifact.sizeInBytes >
        RELEASE_ARTIFACT_MAX_BYTES
      ) {
        throw new ReleaseServiceError(
          `Selected artifact exceeds the ${RELEASE_ARTIFACT_MAX_BYTES} byte release asset limit.`,
          413,
        );
      }

      selected.push(artifact);
    }

    return {
      targetCommitish: run.headSha,
      artifacts: selected,
    };
  }

  async function createOnGitHub(
    owner: string,
    repo: string,
    input: CreateRepositoryReleaseInput,
  ): Promise<CreatedRepositoryRelease> {
    try {
      return await gateway.createRelease(
        owner,
        repo,
        input,
      );
    } catch (error) {
      if (readHttpStatus(error) === 422) {
        try {
          const racedRelease =
            await gateway.getReleaseByTag(
              owner,
              repo,
              input.tagName,
            );

          if (racedRelease) {
            throw new ReleaseServiceError(
              `A release already exists for tag ${input.tagName}.`,
              409,
            );
          }
        } catch (lookupError) {
          if (lookupError instanceof ReleaseServiceError) {
            throw lookupError;
          }
        }
      }

      throw normalizeGitHubError(
        error,
        "write-release",
      );
    }
  }

  async function createRepositoryRelease(
    owner: string,
    repo: string,
    request: CreateReleaseRequest,
  ): Promise<CreateReleaseResult> {
    await assertReleaseDoesNotExist(
      owner,
      repo,
      request.tagName,
    );

    let targetCommitish: string;
    let artifacts: WorkflowArtifact[];

    if (request.source.type === "workflowRun") {
      const source = await validateWorkflowSource(
        owner,
        repo,
        request.source.runId,
        request.source.artifactIds,
      );
      targetCommitish = source.targetCommitish;
      artifacts = source.artifacts;

      await ensureWorkflowTag(
        owner,
        repo,
        request.tagName,
        targetCommitish,
      );
    } else {
      try {
        targetCommitish =
          await gateway.getRepositoryDefaultBranch(
            owner,
            repo,
          );
      } catch (error) {
        throw normalizeGitHubError(
          error,
          "read-releases",
        );
      }

      let defaultBranchHead: string;

      try {
        defaultBranchHead =
          await gateway.getBranchHeadCommit(
            owner,
            repo,
            targetCommitish,
          );
      } catch (error) {
        throw normalizeGitHubError(
          error,
          "read-releases",
        );
      }

      const existingTarget = await readTagTarget(
        owner,
        repo,
        request.tagName,
      );

      if (
        existingTarget !== null &&
        !sameCommit(
          existingTarget,
          defaultBranchHead,
        )
      ) {
        throw new ReleaseServiceError(
          "Existing tag points to a different commit than the default branch head.",
          409,
        );
      }

      artifacts = [];
    }

    const hasAssets = artifacts.length > 0;
    const createInput: CreateRepositoryReleaseInput = {
      tagName: request.tagName,
      targetCommitish,
      ...(request.name !== undefined
        ? { name: request.name }
        : {}),
      ...(request.notes.mode === "manual"
        ? { body: request.notes.body }
        : {}),
      generateReleaseNotes:
        request.notes.mode === "generated",
      draft: hasAssets ? true : request.draft,
      prerelease: request.prerelease,
    };
    const created = await createOnGitHub(
      owner,
      repo,
      createInput,
    );

    if (!hasAssets) {
      return {
        success: true,
        partial: false,
        outcome: request.draft
          ? "draft"
          : "published",
        release: created.release,
        uploadedAssets: [],
        failedArtifacts: [],
        publicationError: null,
      };
    }

    const assetNames = buildReleaseAssetNames(artifacts);
    const uploadedAssets: ReleaseAsset[] = [];
    const failedArtifacts: FailedReleaseArtifact[] = [];

    for (const artifact of artifacts) {
      let archive: WorkflowArtifactArchive | undefined;

      try {
        archive =
          await gateway.downloadWorkflowArtifactArchive(
            owner,
            repo,
            artifact.id,
            artifact.sizeInBytes,
            RELEASE_ARTIFACT_MAX_BYTES,
          );
        const assetName = assetNames.get(artifact.id);

        if (!assetName) {
          throw new GitHubArtifactTransferError(
            "invalid-upload",
            "A safe release asset name could not be generated.",
          );
        }

        const asset = await gateway.uploadReleaseAsset(
          owner,
          repo,
          created.release.id,
          created.uploadUrl,
          assetName,
          archive,
        );
        uploadedAssets.push(asset);
      } catch (error) {
        try {
          await archive?.body.cancel();
        } catch {
          // A fetch implementation may already own the stream.
        }

        failedArtifacts.push({
          artifactId: artifact.id,
          name: artifact.name,
          error: artifactTransferMessage(error),
        });
      }
    }

    const draftRelease = mergeReleaseAssets(
      created.release,
      uploadedAssets,
    );
    const [firstFailure, ...otherFailures] =
      failedArtifacts;

    if (firstFailure) {
      return {
        success: false,
        partial: true,
        outcome: "partial",
        release: {
          ...draftRelease,
          draft: true,
        },
        uploadedAssets,
        failedArtifacts: [
          firstFailure,
          ...otherFailures,
        ],
        publicationError: null,
      };
    }

    if (request.draft) {
      return {
        success: true,
        partial: false,
        outcome: "draft",
        release: {
          ...draftRelease,
          draft: true,
        },
        uploadedAssets,
        failedArtifacts: [],
        publicationError: null,
      };
    }

    try {
      const published = await gateway.updateRelease(
        owner,
        repo,
        created.release.id,
        false,
      );

      return {
        success: true,
        partial: false,
        outcome: "published",
        release: mergeReleaseAssets(
          published,
          uploadedAssets,
        ),
        uploadedAssets,
        failedArtifacts: [],
        publicationError: null,
      };
    } catch (error) {
      const normalized = normalizeGitHubError(
        error,
        "write-release",
      );

      return {
        success: false,
        partial: true,
        outcome: "partial",
        release: {
          ...draftRelease,
          draft: true,
        },
        uploadedAssets,
        failedArtifacts: [],
        publicationError:
          `Assets were uploaded, but the draft could not be published. ${normalized.message}`,
      };
    }
  }

  return {
    listRepositoryReleases,
    createRepositoryRelease,
  };
}

const releaseService = createReleaseService(
  githubAdapter,
);

export const {
  listRepositoryReleases,
  createRepositoryRelease,
} = releaseService;
