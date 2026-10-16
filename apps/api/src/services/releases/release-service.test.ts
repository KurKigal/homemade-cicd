import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const adapterModuleMocks = vi.hoisted(() => {
  class MockGitHubArtifactTransferError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = "GitHubArtifactTransferError";
      this.code = code;
    }
  }

  class MockGitHubTagResolutionError extends Error {
    constructor() {
      super(
        "The existing tag could not be resolved to a commit.",
      );
      this.name = "GitHubTagResolutionError";
    }
  }

  return {
    MockGitHubArtifactTransferError,
    MockGitHubTagResolutionError,
  };
});

vi.mock(
  "../../adapters/github/github-adapter.js",
  () => ({
    GitHubArtifactTransferError:
      adapterModuleMocks.MockGitHubArtifactTransferError,
    GitHubTagResolutionError:
      adapterModuleMocks.MockGitHubTagResolutionError,
    githubAdapter: {},
  }),
);

import type {
  CreateReleaseRequest,
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
} from "../../adapters/github/github-adapter.js";
import {
  buildReleaseAssetNames,
  createReleaseService,
  type ReleaseRepositoryGateway,
  ReleaseServiceError,
} from "./release-service.js";

function release(
  overrides: Partial<RepositoryRelease> = {},
): RepositoryRelease {
  return {
    id: 1,
    tagName: "v1.0.0",
    name: "Version 1",
    body: "Notes",
    draft: true,
    prerelease: false,
    htmlUrl:
      "https://github.com/example/app/releases/tag/v1.0.0",
    targetCommitish: "run-sha",
    createdAt: "2026-08-20T00:00:00Z",
    publishedAt: null,
    author: {
      login: "octocat",
      avatarUrl: "https://avatars.example/octocat",
      profileUrl: "https://github.com/octocat",
    },
    assets: [],
    ...overrides,
  };
}

function asset(
  id: number,
  name: string,
): ReleaseAsset {
  return {
    id,
    name,
    sizeInBytes: 3,
    downloadUrl:
      `https://github.com/example/app/releases/download/v1/${name}`,
    contentType: "application/zip",
    downloadCount: 0,
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
  };
}

function run(
  overrides: Partial<WorkflowRun> = {},
): WorkflowRun {
  return {
    id: 100,
    workflowName: "Build",
    displayTitle: "Build",
    runNumber: 12,
    attempt: 1,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    headBranch: "main",
    headSha: "run-sha",
    htmlUrl:
      "https://github.com/example/app/actions/runs/100",
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:01:00Z",
    startedAt: "2026-08-20T00:00:00Z",
    actor: null,
    ...overrides,
  };
}

function artifact(
  id: number,
  name = `artifact-${id}`,
  overrides: Partial<WorkflowArtifact> = {},
): WorkflowArtifact {
  return {
    id,
    name,
    sizeInBytes: 3,
    expired: false,
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    expiresAt: "2026-09-20T00:00:00Z",
    digest: null,
    workflowRun: {
      id: 100,
      headBranch: "main",
      headSha: "run-sha",
    },
    ...overrides,
  };
}

function manualDefaultRequest(): CreateReleaseRequest {
  return {
    tagName: "v1.0.0",
    name: "Version 1",
    notes: {
      mode: "manual",
      body: "# Notes\n",
    },
    draft: false,
    prerelease: false,
    source: {
      type: "defaultBranch",
    },
  };
}

function workflowRequest(
  artifactIds: number[] = [11],
): CreateReleaseRequest {
  return {
    ...manualDefaultRequest(),
    source: {
      type: "workflowRun",
      runId: 100,
      artifactIds,
    },
  };
}

function createGateway() {
  const gateway = {
    listReleases:
      vi.fn<ReleaseRepositoryGateway["listReleases"]>(),
    getReleaseByTag:
      vi.fn<ReleaseRepositoryGateway["getReleaseByTag"]>(),
    createRelease:
      vi.fn<ReleaseRepositoryGateway["createRelease"]>(),
    updateRelease:
      vi.fn<ReleaseRepositoryGateway["updateRelease"]>(),
    createTagReference:
      vi.fn<ReleaseRepositoryGateway["createTagReference"]>(),
    resolveTagTargetCommit:
      vi.fn<ReleaseRepositoryGateway["resolveTagTargetCommit"]>(),
    getRepositoryDefaultBranch:
      vi.fn<ReleaseRepositoryGateway["getRepositoryDefaultBranch"]>(),
    getBranchHeadCommit:
      vi.fn<ReleaseRepositoryGateway["getBranchHeadCommit"]>(),
    getWorkflowRun:
      vi.fn<ReleaseRepositoryGateway["getWorkflowRun"]>(),
    listWorkflowRunArtifacts:
      vi.fn<ReleaseRepositoryGateway["listWorkflowRunArtifacts"]>(),
    downloadWorkflowArtifactArchive:
      vi.fn<ReleaseRepositoryGateway["downloadWorkflowArtifactArchive"]>(),
    uploadReleaseAsset:
      vi.fn<ReleaseRepositoryGateway["uploadReleaseAsset"]>(),
  } satisfies ReleaseRepositoryGateway;

  gateway.listReleases.mockResolvedValue([]);
  gateway.getReleaseByTag.mockResolvedValue(null);
  gateway.createRelease.mockImplementation(
    async (_owner, _repo, input) => ({
      release: release({
        tagName: input.tagName,
        name: input.name ?? null,
        body: input.body ?? null,
        draft: input.draft,
        prerelease: input.prerelease,
        targetCommitish: input.targetCommitish,
        publishedAt: input.draft
          ? null
          : "2026-08-20T01:00:00Z",
      }),
      uploadUrl:
        "https://uploads.github.com/repos/example/app/releases/1/assets{?name,label}",
    }),
  );
  gateway.updateRelease.mockResolvedValue(
    release({
      draft: false,
      publishedAt: "2026-08-20T01:00:00Z",
    }),
  );
  gateway.createTagReference.mockResolvedValue();
  gateway.resolveTagTargetCommit.mockResolvedValue(
    "run-sha",
  );
  gateway.getRepositoryDefaultBranch.mockResolvedValue(
    "main",
  );
  gateway.getBranchHeadCommit.mockResolvedValue(
    "run-sha",
  );
  gateway.getWorkflowRun.mockResolvedValue(run());
  gateway.listWorkflowRunArtifacts.mockResolvedValue({
    totalCount: 1,
    artifacts: [artifact(11)],
  });
  gateway.downloadWorkflowArtifactArchive
    .mockResolvedValue({
      body: new ReadableStream<Uint8Array>(),
      contentLength: 3,
    });
  gateway.uploadReleaseAsset.mockImplementation(
    async (
      _owner,
      _repo,
      _releaseId,
      _uploadUrl,
      assetName,
    ) => asset(200, assetName),
  );

  return gateway;
}

describe("release service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a published manual release from the default branch", async () => {
    const gateway = createGateway();
    gateway.resolveTagTargetCommit.mockResolvedValueOnce(
      null,
    );
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      manualDefaultRequest(),
    );

    expect(result).toMatchObject({
      success: true,
      partial: false,
      outcome: "published",
    });
    expect(gateway.createRelease).toHaveBeenCalledWith(
      "example",
      "app",
      {
        tagName: "v1.0.0",
        targetCommitish: "main",
        name: "Version 1",
        body: "# Notes\n",
        generateReleaseNotes: false,
        draft: false,
        prerelease: false,
      },
    );
    expect(gateway.createTagReference)
      .not.toHaveBeenCalled();
  });

  it("uses GitHub-generated notes without sending a body", async () => {
    const gateway = createGateway();
    const service = createReleaseService(gateway);
    const request: CreateReleaseRequest = {
      ...manualDefaultRequest(),
      name: undefined,
      notes: {
        mode: "generated",
      },
    };

    await service.createRepositoryRelease(
      "example",
      "app",
      request,
    );

    const input = gateway.createRelease.mock.calls[0]?.[2];
    expect(input).toMatchObject({
      generateReleaseNotes: true,
    });
    expect(input).not.toHaveProperty("body");
    expect(input).not.toHaveProperty("name");
  });

  it("rejects a default-branch release when an existing tag targets another commit", async () => {
    const gateway = createGateway();
    gateway.getBranchHeadCommit.mockResolvedValueOnce(
      "default-head-sha",
    );
    gateway.resolveTagTargetCommit.mockResolvedValueOnce(
      "older-tag-sha",
    );
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        manualDefaultRequest(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Existing tag points to a different commit than the default branch head.",
    });
    expect(gateway.createRelease)
      .not.toHaveBeenCalled();
    expect(gateway.createTagReference)
      .not.toHaveBeenCalled();
  });

  it("creates and verifies a missing workflow tag at the exact run SHA", async () => {
    const gateway = createGateway();
    gateway.resolveTagTargetCommit
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("run-sha");
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      workflowRequest([]),
    );

    expect(gateway.createTagReference).toHaveBeenCalledWith(
      "example",
      "app",
      "v1.0.0",
      "run-sha",
    );
    expect(gateway.createRelease).toHaveBeenCalledWith(
      "example",
      "app",
      expect.objectContaining({
        targetCommitish: "run-sha",
        draft: false,
      }),
    );
    expect(result.outcome).toBe("published");
  });

  it.each([
    {
      label: "failed",
      status: "completed",
      conclusion: "failure",
    },
    {
      label: "in progress",
      status: "in_progress",
      conclusion: null,
    },
  ])("rejects a $label workflow run before mutation", async ({
    status,
    conclusion,
  }) => {
    const gateway = createGateway();
    gateway.getWorkflowRun.mockResolvedValueOnce(
      run({ status, conclusion }),
    );
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        workflowRequest(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Selected workflow run did not succeed.",
    });
    expect(gateway.createTagReference)
      .not.toHaveBeenCalled();
    expect(gateway.createRelease)
      .not.toHaveBeenCalled();
  });

  it("rejects an artifact absent from the run-scoped list", async () => {
    const gateway = createGateway();
    gateway.listWorkflowRunArtifacts.mockResolvedValueOnce({
      totalCount: 1,
      artifacts: [artifact(12)],
    });
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        workflowRequest([11]),
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message:
        "Selected artifact does not belong to this workflow run.",
    });
  });

  it("accepts run-scoped artifact metadata when nested workflow_run is omitted", async () => {
    const gateway = createGateway();
    gateway.listWorkflowRunArtifacts.mockResolvedValueOnce({
      totalCount: 1,
      artifacts: [
        artifact(11, "build", {
          workflowRun: null,
        }),
      ],
    });
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        {
          ...workflowRequest([11]),
          draft: true,
        },
      ),
    ).resolves.toMatchObject({
      outcome: "draft",
    });
  });

  it.each([
    {
      label: "cross-run metadata",
      artifact: artifact(11, "build", {
        workflowRun: {
          id: 999,
          headBranch: "other",
          headSha: "other-sha",
        },
      }),
      statusCode: 404,
    },
    {
      label: "expired artifact",
      artifact: artifact(11, "build", {
        expired: true,
      }),
      statusCode: 409,
    },
    {
      label: "oversized artifact",
      artifact: artifact(11, "build", {
        sizeInBytes:
          RELEASE_ARTIFACT_MAX_BYTES + 1,
      }),
      statusCode: 413,
    },
  ])("rejects $label before creating a tag", async ({
    artifact: selectedArtifact,
    statusCode,
  }) => {
    const gateway = createGateway();
    gateway.listWorkflowRunArtifacts.mockResolvedValueOnce({
      totalCount: 1,
      artifacts: [selectedArtifact],
    });
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        workflowRequest(),
      ),
    ).rejects.toMatchObject({ statusCode });
    expect(gateway.createTagReference)
      .not.toHaveBeenCalled();
  });

  it("rejects existing releases including drafts", async () => {
    const gateway = createGateway();
    gateway.getReleaseByTag.mockResolvedValueOnce(
      release({ draft: true }),
    );
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        workflowRequest(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining(
        "already exists",
      ),
    });
  });

  it("accepts a matching existing tag and rejects a mismatched tag without moving it", async () => {
    const matchingGateway = createGateway();
    matchingGateway.resolveTagTargetCommit
      .mockResolvedValue("run-sha");
    const matchingService = createReleaseService(
      matchingGateway,
    );

    await expect(
      matchingService.createRepositoryRelease(
        "example",
        "app",
        workflowRequest([]),
      ),
    ).resolves.toMatchObject({
      outcome: "published",
    });
    expect(matchingGateway.createTagReference)
      .not.toHaveBeenCalled();

    const mismatchGateway = createGateway();
    mismatchGateway.resolveTagTargetCommit
      .mockResolvedValue("different-sha");
    const mismatchService = createReleaseService(
      mismatchGateway,
    );

    await expect(
      mismatchService.createRepositoryRelease(
        "example",
        "app",
        workflowRequest([]),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Existing tag points to a different commit.",
    });
    expect(mismatchGateway.createTagReference)
      .not.toHaveBeenCalled();
  });

  it("handles a create-ref race only when the raced tag matches", async () => {
    const matchingGateway = createGateway();
    matchingGateway.resolveTagTargetCommit
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("run-sha");
    matchingGateway.createTagReference
      .mockRejectedValueOnce(
        Object.assign(new Error("conflict"), {
          status: 422,
        }),
      );
    const matchingService = createReleaseService(
      matchingGateway,
    );

    await expect(
      matchingService.createRepositoryRelease(
        "example",
        "app",
        workflowRequest([]),
      ),
    ).resolves.toMatchObject({
      outcome: "published",
    });

    const mismatchGateway = createGateway();
    mismatchGateway.resolveTagTargetCommit
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("other-sha");
    mismatchGateway.createTagReference
      .mockRejectedValueOnce(
        Object.assign(new Error("conflict"), {
          status: 409,
        }),
      );
    const mismatchService = createReleaseService(
      mismatchGateway,
    );

    await expect(
      mismatchService.createRepositoryRelease(
        "example",
        "app",
        workflowRequest([]),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message:
        "Existing tag points to a different commit.",
    });
  });

  it("sanitizes names and resolves adversarial collisions deterministically", () => {
    const names = buildReleaseAssetNames([
      artifact(1, "foo"),
      artifact(99, "foo-2"),
      artifact(2, "foo"),
      artifact(3, "../android\\apk\u0000signed"),
    ]);

    expect([...names.values()]).toEqual([
      "foo.zip",
      "foo-2.zip",
      "foo-2-2.zip",
      "android-apk-signed.zip",
    ]);
    expect(new Set(names.values()).size).toBe(4);
  });

  it("uses draft-first sequential uploads before publishing", async () => {
    const gateway = createGateway();
    gateway.listWorkflowRunArtifacts.mockResolvedValueOnce({
      totalCount: 2,
      artifacts: [
        artifact(11, "android-apk-signed"),
        artifact(12, "android-aab-signed"),
      ],
    });
    gateway.uploadReleaseAsset
      .mockResolvedValueOnce(
        asset(201, "android-apk-signed.zip"),
      )
      .mockResolvedValueOnce(
        asset(202, "android-aab-signed.zip"),
      );
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      workflowRequest([11, 12]),
    );

    expect(gateway.createRelease.mock.calls[0]?.[2])
      .toMatchObject({
        draft: true,
        targetCommitish: "run-sha",
      });
    expect(gateway.uploadReleaseAsset)
      .toHaveBeenCalledTimes(2);
    expect(
      gateway.uploadReleaseAsset.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      gateway.uploadReleaseAsset.mock
        .invocationCallOrder[1] ?? 0,
    );
    expect(
      gateway.uploadReleaseAsset.mock
        .invocationCallOrder[1],
    ).toBeLessThan(
      gateway.updateRelease.mock
        .invocationCallOrder[0] ?? 0,
    );
    expect(gateway.updateRelease).toHaveBeenCalledWith(
      "example",
      "app",
      1,
      false,
    );
    expect(result).toMatchObject({
      success: true,
      partial: false,
      outcome: "published",
      uploadedAssets: [
        { name: "android-apk-signed.zip" },
        { name: "android-aab-signed.zip" },
      ],
    });
  });

  it("keeps a user-requested asset release as a draft", async () => {
    const gateway = createGateway();
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      {
        ...workflowRequest(),
        draft: true,
      },
    );

    expect(result).toMatchObject({
      success: true,
      partial: false,
      outcome: "draft",
      release: { draft: true },
    });
    expect(gateway.updateRelease)
      .not.toHaveBeenCalled();
  });

  it("continues sequential transfers but leaves the release draft after an asset failure", async () => {
    const gateway = createGateway();
    gateway.listWorkflowRunArtifacts.mockResolvedValueOnce({
      totalCount: 2,
      artifacts: [
        artifact(11, "apk"),
        artifact(12, "aab"),
      ],
    });
    gateway.uploadReleaseAsset
      .mockRejectedValueOnce(
        new GitHubArtifactTransferError(
          "upload",
          "GitHub could not upload the selected release asset.",
        ),
      )
      .mockResolvedValueOnce(asset(202, "aab.zip"));
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      workflowRequest([11, 12]),
    );

    expect(gateway.uploadReleaseAsset)
      .toHaveBeenCalledTimes(2);
    expect(gateway.updateRelease)
      .not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      partial: true,
      outcome: "partial",
      release: {
        draft: true,
        htmlUrl: expect.stringContaining("github.com"),
      },
      uploadedAssets: [{ name: "aab.zip" }],
      failedArtifacts: [
        {
          artifactId: 11,
          name: "apk",
          error: expect.stringContaining("could not upload"),
        },
      ],
      publicationError: null,
    });
  });

  it("returns a 2xx-compatible partial result when final publication fails", async () => {
    const gateway = createGateway();
    gateway.updateRelease.mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), {
        status: 403,
      }),
    );
    const service = createReleaseService(gateway);

    const result = await service.createRepositoryRelease(
      "example",
      "app",
      workflowRequest(),
    );

    expect(result).toMatchObject({
      success: false,
      partial: true,
      outcome: "partial",
      release: {
        draft: true,
        htmlUrl: expect.stringContaining("github.com"),
      },
      failedArtifacts: [],
      publicationError: expect.stringContaining(
        "Contents write permission",
      ),
    });
  });

  it("translates a create-release race into a duplicate conflict", async () => {
    const gateway = createGateway();
    gateway.createRelease.mockRejectedValueOnce(
      Object.assign(new Error("validation"), {
        status: 422,
      }),
    );
    gateway.getReleaseByTag
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(release());
    const service = createReleaseService(gateway);

    await expect(
      service.createRepositoryRelease(
        "example",
        "app",
        manualDefaultRequest(),
      ),
    ).rejects.toEqual(
      new ReleaseServiceError(
        "A release already exists for tag v1.0.0.",
        409,
      ),
    );
  });
});
