import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const actionMocks = vi.hoisted(() => ({
  listRepoSecrets: vi.fn(),
  getRepoPublicKey: vi.fn(),
  createOrUpdateRepoSecret: vi.fn(),
  deleteRepoSecret: vi.fn(),
}));

vi.mock("../../lib/github.js", () => ({
  github: {
    rest: {
      actions: actionMocks,
    },
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    githubToken: "test-token",
  },
}));

import {
  GitHubAdapter,
} from "./github-adapter.js";

describe("GitHubAdapter repository secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps repository secret metadata without values", async () => {
    actionMocks.listRepoSecrets.mockResolvedValueOnce({
      data: {
        total_count: 1,
        secrets: [
          {
            name: "HOMEMADE_ANDROID_KEY_ALIAS",
            created_at: "2026-08-17T00:00:00Z",
            updated_at: "2026-08-17T01:00:00Z",
          },
        ],
      },
    });
    const adapter = new GitHubAdapter();

    const secrets = await adapter.listRepositorySecrets(
      "example",
      "app",
    );

    expect(secrets).toEqual([
      {
        name: "HOMEMADE_ANDROID_KEY_ALIAS",
        createdAt: "2026-08-17T00:00:00Z",
        updatedAt: "2026-08-17T01:00:00Z",
      },
    ]);
    expect(JSON.stringify(secrets)).not.toContain("value");
  });

  it("reads every repository secret page before reporting status", async () => {
    const firstPageSecrets = Array.from(
      { length: 100 },
      (_, index) => ({
        name: `SECRET_${index}`,
        created_at: "2026-08-17T00:00:00Z",
        updated_at: "2026-08-17T01:00:00Z",
      }),
    );

    actionMocks.listRepoSecrets
      .mockResolvedValueOnce({
        data: {
          total_count: 101,
          secrets: firstPageSecrets,
        },
      })
      .mockResolvedValueOnce({
        data: {
          total_count: 101,
          secrets: [
            {
              name: "HOMEMADE_IOS_CERTIFICATE_PASSWORD",
              created_at: "2026-08-17T00:00:00Z",
              updated_at: "2026-08-17T01:00:00Z",
            },
          ],
        },
      });
    const adapter = new GitHubAdapter();

    const secrets = await adapter.listRepositorySecrets(
      "example",
      "app",
    );

    expect(secrets).toHaveLength(101);
    expect(secrets.at(-1)?.name).toBe(
      "HOMEMADE_IOS_CERTIFICATE_PASSWORD",
    );
    expect(actionMocks.listRepoSecrets).toHaveBeenNthCalledWith(
      1,
      {
        owner: "example",
        repo: "app",
        per_page: 100,
        page: 1,
      },
    );
    expect(actionMocks.listRepoSecrets).toHaveBeenNthCalledWith(
      2,
      {
        owner: "example",
        repo: "app",
        per_page: 100,
        page: 2,
      },
    );
  });

  it("maps the Actions public key", async () => {
    actionMocks.getRepoPublicKey.mockResolvedValueOnce({
      data: {
        key_id: "key-id",
        key: "base64-public-key",
      },
    });
    const adapter = new GitHubAdapter();

    await expect(
      adapter.getRepositoryActionsPublicKey(
        "example",
        "app",
      ),
    ).resolves.toEqual({
      keyId: "key-id",
      key: "base64-public-key",
    });
  });

  it("sends only encrypted values to GitHub", async () => {
    actionMocks.createOrUpdateRepoSecret
      .mockResolvedValueOnce({ data: {} });
    const adapter = new GitHubAdapter();

    await adapter.createOrUpdateRepositorySecret(
      "example",
      "app",
      "HOMEMADE_ANDROID_KEY_ALIAS",
      "sealed-ciphertext",
      "key-id",
    );

    expect(actionMocks.createOrUpdateRepoSecret)
      .toHaveBeenCalledWith({
        owner: "example",
        repo: "app",
        secret_name: "HOMEMADE_ANDROID_KEY_ALIAS",
        encrypted_value: "sealed-ciphertext",
        key_id: "key-id",
      });
  });

  it("makes missing-secret deletion idempotent", async () => {
    actionMocks.deleteRepoSecret.mockRejectedValueOnce(
      Object.assign(new Error("not found"), {
        status: 404,
      }),
    );
    const adapter = new GitHubAdapter();

    await expect(
      adapter.deleteRepositorySecret(
        "example",
        "app",
        "HOMEMADE_ANDROID_KEY_ALIAS",
      ),
    ).resolves.toBeUndefined();
  });
});
