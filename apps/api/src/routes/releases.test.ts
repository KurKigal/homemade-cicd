import Fastify from "fastify";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  CreateReleaseResult,
  RepositoryRelease,
} from "@homemade-cicd/core";

const releaseServiceMocks = vi.hoisted(() => {
  class MockReleaseServiceError extends Error {
    readonly statusCode: number;

    constructor(message: string, statusCode: number) {
      super(message);
      this.name = "ReleaseServiceError";
      this.statusCode = statusCode;
    }
  }

  return {
    MockReleaseServiceError,
    listRepositoryReleases: vi.fn(),
    createRepositoryRelease: vi.fn(),
  };
});

vi.mock(
  "../services/releases/release-service.js",
  () => ({
    ReleaseServiceError:
      releaseServiceMocks.MockReleaseServiceError,
    listRepositoryReleases:
      releaseServiceMocks.listRepositoryReleases,
    createRepositoryRelease:
      releaseServiceMocks.createRepositoryRelease,
  }),
);

import {
  createRepositoryRelease,
  listRepositoryReleases,
  ReleaseServiceError,
} from "../services/releases/release-service.js";
import {
  releasesRoutes,
} from "./releases.js";

const repositoryRelease: RepositoryRelease = {
  id: 1,
  tagName: "v1.0.0",
  name: "Version 1",
  body: "Notes",
  draft: false,
  prerelease: false,
  htmlUrl:
    "https://github.com/example/app/releases/tag/v1.0.0",
  targetCommitish: "abc123",
  createdAt: "2026-08-20T00:00:00Z",
  publishedAt: "2026-08-20T01:00:00Z",
  author: {
    login: "octocat",
    avatarUrl: "https://avatars.example/octocat",
    profileUrl: "https://github.com/octocat",
  },
  assets: [],
};

const successfulResult: CreateReleaseResult = {
  success: true,
  partial: false,
  outcome: "published",
  release: repositoryRelease,
  uploadedAssets: [],
  failedArtifacts: [],
  publicationError: null,
};

async function createApp() {
  const app = Fastify();
  await app.register(releasesRoutes);
  return app;
}

describe("release routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listRepositoryReleases)
      .mockResolvedValue([repositoryRelease]);
    vi.mocked(createRepositoryRelease)
      .mockResolvedValue(successfulResult);
  });

  it("lists mapped repository releases", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/github/repos/example/app/releases",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        repositoryRelease,
      ]);
      expect(listRepositoryReleases)
        .toHaveBeenCalledWith("example", "app");
    } finally {
      await app.close();
    }
  });

  it("validates and creates a release", async () => {
    const app = await createApp();
    const payload = {
      tagName: "  v1.0.0  ",
      name: "Version 1",
      notes: {
        mode: "manual",
        body: "# Notes\n",
      },
      draft: false,
      prerelease: false,
      source: {
        type: "workflowRun",
        runId: 100,
        artifactIds: [11],
      },
    };

    try {
      const response = await app.inject({
        method: "POST",
        url: "/github/repos/example/app/releases",
        payload,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(
        successfulResult,
      );
      expect(createRepositoryRelease)
        .toHaveBeenCalledWith(
          "example",
          "app",
          {
            ...payload,
            tagName: "v1.0.0",
          },
        );
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      label: "an empty tag",
      payload: {
        tagName: "   ",
        notes: { mode: "generated" },
        draft: false,
        prerelease: false,
        source: { type: "defaultBranch" },
      },
    },
    {
      label: "client-controlled artifacts on the default branch",
      payload: {
        tagName: "v1.0.0",
        notes: { mode: "generated" },
        draft: false,
        prerelease: false,
        source: {
          type: "defaultBranch",
          artifactIds: [11],
        },
      },
    },
  ])("returns 400 for $label", async ({ payload }) => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/github/repos/example/app/releases",
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Invalid release request.",
      });
      expect(createRepositoryRelease)
        .not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns a duplicate tag conflict without raw GitHub errors", async () => {
    vi.mocked(createRepositoryRelease)
      .mockRejectedValueOnce(
        new ReleaseServiceError(
          "A release already exists for tag v1.0.0.",
          409,
        ),
      );
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/github/repos/example/app/releases",
        payload: {
          tagName: "v1.0.0",
          notes: { mode: "generated" },
          draft: false,
          prerelease: false,
          source: { type: "defaultBranch" },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error:
          "A release already exists for tag v1.0.0.",
      });
      expect(response.body).not.toContain("stack");
    } finally {
      await app.close();
    }
  });

  it("returns asset and publication partial outcomes as created resources", async () => {
    const partialResult: CreateReleaseResult = {
      success: false,
      partial: true,
      outcome: "partial",
      release: {
        ...repositoryRelease,
        draft: true,
        publishedAt: null,
      },
      uploadedAssets: [],
      failedArtifacts: [
        {
          artifactId: 11,
          name: "android-apk-signed",
          error:
            "GitHub could not upload the selected release asset.",
        },
      ],
      publicationError: null,
    };
    vi.mocked(createRepositoryRelease)
      .mockResolvedValueOnce(partialResult);
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/github/repos/example/app/releases",
        payload: {
          tagName: "v1.0.0",
          notes: {
            mode: "manual",
            body: "Notes",
          },
          draft: false,
          prerelease: false,
          source: {
            type: "workflowRun",
            runId: 100,
            artifactIds: [11],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(partialResult);
      expect(response.json()).toMatchObject({
        partial: true,
        release: {
          draft: true,
          htmlUrl: expect.stringContaining("github.com"),
        },
      });
    } finally {
      await app.close();
    }
  });
});
