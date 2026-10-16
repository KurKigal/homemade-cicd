import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const githubMocks = vi.hoisted(() => ({
  rest: {
    repos: {
      listReleases: vi.fn(),
      getReleaseByTag: vi.fn(),
      createRelease: vi.fn(),
      updateRelease: vi.fn(),
      getBranch: vi.fn(),
    },
    git: {
      getRef: vi.fn(),
      getTag: vi.fn(),
      createRef: vi.fn(),
    },
    actions: {
      listWorkflowRunArtifacts: vi.fn(),
    },
  },
  request: vi.fn(),
}));

vi.mock("../../lib/github.js", () => ({
  github: githubMocks,
}));

vi.mock("../../config/env.js", () => ({
  env: {
    githubToken: "test-token",
  },
}));

import {
  GitHubAdapter,
  GitHubArtifactTransferError,
  GitHubTagResolutionError,
} from "./github-adapter.js";

function githubAsset(
  id = 10,
  name = "build.zip",
) {
  return {
    id,
    name,
    size: 3,
    browser_download_url:
      `https://github.com/example/app/releases/download/v1/${name}`,
    content_type: "application/zip",
    download_count: 2,
    created_at: "2026-08-20T00:00:00Z",
    updated_at: "2026-08-20T01:00:00Z",
  };
}

function githubRelease(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 1,
    tag_name: "v1.0.0",
    name: "Version 1",
    body: "Notes",
    draft: false,
    prerelease: false,
    html_url:
      "https://github.com/example/app/releases/tag/v1.0.0",
    upload_url:
      "https://uploads.github.com/repos/example/app/releases/1/assets{?name,label}",
    target_commitish: "main",
    created_at: "2026-08-20T00:00:00Z",
    published_at: "2026-08-20T01:00:00Z",
    author: {
      login: "octocat",
      avatar_url: "https://avatars.example/octocat",
      html_url: "https://github.com/octocat",
    },
    assets: [githubAsset()],
    ...overrides,
  };
}

function notFound() {
  return Object.assign(new Error("not found"), {
    status: 404,
  });
}

describe("GitHubAdapter releases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps release and asset metadata without raw GitHub fields", async () => {
    githubMocks.rest.repos.listReleases
      .mockResolvedValueOnce({
        data: [githubRelease()],
      });
    const adapter = new GitHubAdapter();

    const releases = await adapter.listReleases(
      "example",
      "app",
    );

    expect(releases).toEqual([
      expect.objectContaining({
        id: 1,
        tagName: "v1.0.0",
        targetCommitish: "main",
        author: {
          login: "octocat",
          avatarUrl: "https://avatars.example/octocat",
          profileUrl: "https://github.com/octocat",
        },
        assets: [
          expect.objectContaining({
            id: 10,
            name: "build.zip",
            sizeInBytes: 3,
          }),
        ],
      }),
    ]);
    expect(releases[0]).not.toHaveProperty("upload_url");
    expect(githubMocks.rest.repos.listReleases)
      .toHaveBeenCalledWith({
        owner: "example",
        repo: "app",
        per_page: 100,
        page: 1,
      });
  });

  it("falls back to release listing so draft tags are detected", async () => {
    githubMocks.rest.repos.getReleaseByTag
      .mockRejectedValueOnce(notFound());
    githubMocks.rest.repos.listReleases
      .mockResolvedValueOnce({
        data: [
          githubRelease({
            tag_name: "v-draft",
            draft: true,
            published_at: null,
          }),
        ],
      });
    const adapter = new GitHubAdapter();

    const release = await adapter.getReleaseByTag(
      "example",
      "app",
      "v-draft",
    );

    expect(release).toMatchObject({
      tagName: "v-draft",
      draft: true,
    });
  });

  it("reads every run artifact page for ownership validation", async () => {
    const rawArtifact = (id: number) => ({
      id,
      name: `artifact-${id}`,
      size_in_bytes: 3,
      expired: false,
      created_at: "2026-08-20T00:00:00Z",
      updated_at: "2026-08-20T00:00:00Z",
      expires_at: "2026-09-20T00:00:00Z",
      digest: null,
      workflow_run: {
        id: 100,
        head_branch: "main",
        head_sha: "run-sha",
      },
    });
    githubMocks.rest.actions.listWorkflowRunArtifacts
      .mockResolvedValueOnce({
        data: {
          total_count: 101,
          artifacts: Array.from(
            { length: 100 },
            (_, index) => rawArtifact(index + 1),
          ),
        },
      })
      .mockResolvedValueOnce({
        data: {
          total_count: 101,
          artifacts: [rawArtifact(101)],
        },
      });
    const adapter = new GitHubAdapter();

    const result =
      await adapter.listWorkflowRunArtifacts(
        "example",
        "app",
        100,
      );

    expect(result.totalCount).toBe(101);
    expect(result.artifacts).toHaveLength(101);
    expect(result.artifacts.at(-1)?.id).toBe(101);
    expect(
      githubMocks.rest.actions.listWorkflowRunArtifacts,
    ).toHaveBeenNthCalledWith(2, {
      owner: "example",
      repo: "app",
      run_id: 100,
      per_page: 100,
      page: 2,
    });
  });

  it("omits a generated release body and maps create/update calls", async () => {
    githubMocks.rest.repos.createRelease
      .mockResolvedValueOnce({
        data: githubRelease({
          assets: [],
        }),
      });
    githubMocks.rest.repos.updateRelease
      .mockResolvedValueOnce({
        data: githubRelease({
          draft: false,
        }),
      });
    const adapter = new GitHubAdapter();

    const created = await adapter.createRelease(
      "example",
      "app",
      {
        tagName: "v1.0.0",
        targetCommitish: "abc123",
        generateReleaseNotes: true,
        draft: true,
        prerelease: false,
      },
    );
    const published = await adapter.updateRelease(
      "example",
      "app",
      1,
      false,
    );

    expect(githubMocks.rest.repos.createRelease)
      .toHaveBeenCalledWith({
        owner: "example",
        repo: "app",
        tag_name: "v1.0.0",
        target_commitish: "abc123",
        generate_release_notes: true,
        draft: true,
        prerelease: false,
      });
    expect(created.uploadUrl).toContain(
      "uploads.github.com",
    );
    expect(published.draft).toBe(false);
  });

  it("creates a lightweight tag reference without moving it", async () => {
    githubMocks.rest.git.createRef.mockResolvedValueOnce({
      data: {},
    });
    const adapter = new GitHubAdapter();

    await adapter.createTagReference(
      "example",
      "app",
      "v1.0.0",
      "abc123",
    );

    expect(githubMocks.rest.git.createRef)
      .toHaveBeenCalledWith({
        owner: "example",
        repo: "app",
        ref: "refs/tags/v1.0.0",
        sha: "abc123",
      });
  });

  it("reads the default branch head SHA from GitHub", async () => {
    githubMocks.rest.repos.getBranch.mockResolvedValueOnce({
      data: {
        commit: {
          sha: "default-head-sha",
        },
      },
    });
    const adapter = new GitHubAdapter();

    await expect(
      adapter.getBranchHeadCommit(
        "example",
        "app",
        "main",
      ),
    ).resolves.toBe("default-head-sha");
    expect(githubMocks.rest.repos.getBranch)
      .toHaveBeenCalledWith({
        owner: "example",
        repo: "app",
        branch: "main",
      });
  });

  it("resolves lightweight and nested annotated tags", async () => {
    githubMocks.rest.git.getRef
      .mockResolvedValueOnce({
        data: {
          object: {
            type: "commit",
            sha: "lightweight-sha",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          object: {
            type: "tag",
            sha: "tag-one",
          },
        },
      });
    githubMocks.rest.git.getTag
      .mockResolvedValueOnce({
        data: {
          object: {
            type: "tag",
            sha: "tag-two",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          object: {
            type: "commit",
            sha: "annotated-sha",
          },
        },
      });
    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "light",
      ),
    ).resolves.toBe("lightweight-sha");
    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "annotated",
      ),
    ).resolves.toBe("annotated-sha");
  });

  it("allows a commit on the final annotated-tag dereference", async () => {
    githubMocks.rest.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          type: "tag",
          sha: "tag-0",
        },
      },
    });

    for (let index = 0; index < 10; index += 1) {
      githubMocks.rest.git.getTag.mockResolvedValueOnce({
        data: {
          object: index === 9
            ? {
                type: "commit",
                sha: "final-commit",
              }
            : {
                type: "tag",
                sha: `tag-${index + 1}`,
              },
        },
      });
    }

    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "deep",
      ),
    ).resolves.toBe("final-commit");
    expect(githubMocks.rest.git.getTag)
      .toHaveBeenCalledTimes(10);
  });

  it("rejects a tag chain beyond the dereference limit", async () => {
    githubMocks.rest.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          type: "tag",
          sha: "tag-0",
        },
      },
    });

    for (let index = 0; index < 10; index += 1) {
      githubMocks.rest.git.getTag.mockResolvedValueOnce({
        data: {
          object: {
            type: "tag",
            sha: `tag-${index + 1}`,
          },
        },
      });
    }

    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "too-deep",
      ),
    ).rejects.toBeInstanceOf(GitHubTagResolutionError);
    expect(githubMocks.rest.git.getTag)
      .toHaveBeenCalledTimes(10);
  });

  it.each([
    {
      label: "empty type",
      target: { type: "", sha: "abc" },
    },
    {
      label: "blank SHA",
      target: { type: "commit", sha: "   " },
    },
    {
      label: "non-commit object",
      target: { type: "tree", sha: "abc" },
    },
  ])("rejects a malformed tag target with $label", async ({ target }) => {
    githubMocks.rest.git.getRef.mockResolvedValueOnce({
      data: { object: target },
    });
    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "broken",
      ),
    ).rejects.toBeInstanceOf(GitHubTagResolutionError);
  });

  it("rejects an annotated-tag loop and returns null for a missing ref", async () => {
    githubMocks.rest.git.getRef
      .mockResolvedValueOnce({
        data: {
          object: {
            type: "tag",
            sha: "tag-loop",
          },
        },
      })
      .mockRejectedValueOnce(notFound());
    githubMocks.rest.git.getTag.mockResolvedValueOnce({
      data: {
        object: {
          type: "tag",
          sha: "tag-loop",
        },
      },
    });
    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "loop",
      ),
    ).rejects.toBeInstanceOf(GitHubTagResolutionError);
    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "missing",
      ),
    ).resolves.toBeNull();
  });

  it("treats a missing intermediate annotated-tag object as a malformed chain", async () => {
    githubMocks.rest.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          type: "tag",
          sha: "missing-tag-object",
        },
      },
    });
    githubMocks.rest.git.getTag.mockRejectedValueOnce(
      notFound(),
    );
    const adapter = new GitHubAdapter();

    await expect(
      adapter.resolveTagTargetCommit(
        "example",
        "app",
        "broken-annotated",
      ),
    ).rejects.toBeInstanceOf(GitHubTagResolutionError);
  });

  it("streams the server-derived artifact archive without authentication on the signed URL", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://objects.githubusercontent.com/signed-artifact",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new Uint8Array([1, 2, 3]),
              );
              controller.close();
            },
          }),
          {
            status: 200,
            headers: {
              "content-length": "3",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new GitHubAdapter();

    const archive =
      await adapter.downloadWorkflowArtifactArchive(
        "example",
        "app",
        50,
        3,
        10,
      );
    const bytes = await new Response(
      archive.body,
    ).bytes();

    expect([...bytes]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL(
        "https://objects.githubusercontent.com/signed-artifact",
      ),
      {
        method: "GET",
        redirect: "error",
      },
    );
    expect(
      fetchMock.mock.calls[1]?.[1]?.headers,
    ).toBeUndefined();
  });

  it("rejects oversized metadata before downloading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new GitHubAdapter();

    await expect(
      adapter.downloadWorkflowArtifactArchive(
        "example",
        "app",
        50,
        11,
        10,
      ),
    ).rejects.toMatchObject({
      code: "size",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an archive without a verifiable Content-Length", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://objects.githubusercontent.com/signed-artifact",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new Uint8Array([1, 2, 3]),
              );
              controller.close();
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new GitHubAdapter();

    await expect(
      adapter.downloadWorkflowArtifactArchive(
        "example",
        "app",
        50,
        3,
        10,
      ),
    ).rejects.toMatchObject({
      code: "size",
    });
  });

  it("enforces the hard byte limit while the stream is consumed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://objects.githubusercontent.com/signed-artifact",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new Uint8Array([1, 2, 3, 4]),
              );
              controller.close();
            },
          }),
          {
            status: 200,
            headers: {
              "content-length": "3",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new GitHubAdapter();
    const archive =
      await adapter.downloadWorkflowArtifactArchive(
        "example",
        "app",
        50,
        3,
        10,
      );

    await expect(
      new Response(archive.body).bytes(),
    ).rejects.toBeInstanceOf(
      GitHubArtifactTransferError,
    );
  });

  it("uploads the original stream only to the release-derived upload URL", async () => {
    githubMocks.request.mockResolvedValueOnce({
      data: githubAsset(20, "android.zip"),
    });
    const body = new ReadableStream<Uint8Array>();
    const adapter = new GitHubAdapter();

    const asset = await adapter.uploadReleaseAsset(
      "example",
      "app",
      1,
      "https://uploads.github.com/repos/example/app/releases/1/assets{?name,label}",
      "android.zip",
      {
        body,
        contentLength: 3,
      },
    );

    expect(asset).toMatchObject({
      id: 20,
      name: "android.zip",
    });
    expect(githubMocks.request).toHaveBeenCalledWith({
      method: "POST",
      url: "https://uploads.github.com/repos/example/app/releases/1/assets{?name,label}",
      name: "android.zip",
      headers: {
        accept: "application/vnd.github+json",
        "content-type": "application/zip",
        "content-length": "3",
      },
      data: body,
    });
  });

  it("rejects an upload URL that does not match the created release", async () => {
    const adapter = new GitHubAdapter();

    await expect(
      adapter.uploadReleaseAsset(
        "example",
        "app",
        1,
        "https://attacker.example/repos/example/app/releases/1/assets{?name,label}",
        "build.zip",
        {
          body: new ReadableStream<Uint8Array>(),
          contentLength: 3,
        },
      ),
    ).rejects.toMatchObject({
      code: "invalid-upload",
    });
    expect(githubMocks.request).not.toHaveBeenCalled();
  });

  it("rejects a GitHub upload hostname with a custom port", async () => {
    const adapter = new GitHubAdapter();

    await expect(
      adapter.uploadReleaseAsset(
        "example",
        "app",
        1,
        "https://uploads.github.com:8443/repos/example/app/releases/1/assets{?name,label}",
        "build.zip",
        {
          body: new ReadableStream<Uint8Array>(),
          contentLength: 3,
        },
      ),
    ).rejects.toMatchObject({
      code: "invalid-upload",
    });
    expect(githubMocks.request).not.toHaveBeenCalled();
  });
});
