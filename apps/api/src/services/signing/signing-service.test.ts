import type {
  FlutterPipelineConfig,
  RepositorySigningSecretsStatus,
  RepositorySigningStatus,
} from "@homemade-cicd/core";
import {
  ANDROID_SIGNING_SECRET_NAMES,
  IOS_SIGNING_SECRET_NAMES,
  SIGNING_SECRET_NAMES,
} from "@homemade-cicd/core";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "../../adapters/github/github-adapter.js",
  () => ({
    githubAdapter: {},
  }),
);

import {
  createSigningService,
  SigningServiceError,
} from "./signing-service.js";
import type {
  RepositoryReader,
} from "../repositories/repository-reader.js";

function statusFromSecrets(
  secrets: RepositorySigningSecretsStatus,
): RepositorySigningStatus {
  const androidCredentialsReady =
    Object.values(secrets.android).every(Boolean);
  const iosCredentialsReady =
    Object.values(secrets.ios).every(Boolean);

  return {
    android: {
      platformPresent: true,
      projectReady: true,
      credentialsReady: androidCredentialsReady,
      ready: androidCredentialsReady,
      issues: androidCredentialsReady
        ? []
        : ["Android signing credentials are missing."],
      secrets: secrets.android,
    },
    ios: {
      platformPresent: true,
      projectReady: true,
      credentialsReady: iosCredentialsReady,
      ready: iosCredentialsReady,
      issues: iosCredentialsReady
        ? []
        : ["iOS signing credentials are missing."],
      detectedTeamId: "ABCDE12345",
      detectedBundleId: "com.example.app",
      secrets: secrets.ios,
    },
  };
}

function createGateway(initialNames: readonly string[] = []) {
  const names = new Set(initialNames);
  const deleted: string[] = [];
  const writes: Array<{
    name: string;
    encryptedValue: string;
    keyId: string;
  }> = [];
  let writeFailureName: string | undefined;
  let listFailure: unknown;

  return {
    names,
    deleted,
    writes,
    failWriteAt(name: string) {
      writeFailureName = name;
    },
    failListWith(error: unknown) {
      listFailure = error;
    },
    async listRootEntryNames() {
      return new Set<string>();
    },
    async readTextFile() {
      return null;
    },
    async pathExists() {
      return false;
    },
    async listRepositorySecrets() {
      if (listFailure) {
        throw listFailure;
      }

      return [...names].map((name) => ({
        name,
        createdAt: "2026-08-17T00:00:00Z",
        updatedAt: "2026-08-17T00:00:00Z",
      }));
    },
    async getRepositoryActionsPublicKey() {
      return {
        keyId: "key-id",
        key: "public-key",
      };
    },
    async createOrUpdateRepositorySecret(
      _owner: string,
      _repo: string,
      name: string,
      encryptedValue: string,
      keyId: string,
    ) {
      if (name === writeFailureName) {
        throw Object.assign(
          new Error("forbidden"),
          { status: 403 },
        );
      }

      writes.push({
        name,
        encryptedValue,
        keyId,
      });
      names.add(name);
    },
    async deleteRepositorySecret(
      _owner: string,
      _repo: string,
      name: string,
    ) {
      deleted.push(name);
      names.delete(name);
    },
  };
}

const inspectReadiness = vi.fn(
  async (
    _reader: RepositoryReader,
    _owner: string,
    _repo: string,
    secrets: RepositorySigningSecretsStatus,
  ) => statusFromSecrets(secrets),
);

const encryptSecret = vi.fn(
  async (_key: string, value: string) =>
    `sealed-${value.length}`,
);

function flutterConfig(
  signing: "none" | "android" | "ios",
): FlutterPipelineConfig {
  return {
    branch: "main",
    trigger: {
      push: true,
      pullRequest: true,
      manual: true,
    },
    checks: {
      analyze: true,
      test: true,
    },
    android: {
      enabled: true,
      apk: true,
      aab: true,
      signing: {
        enabled: signing === "android",
      },
    },
    ios: {
      enabled: true,
      unsignedBuild: signing !== "ios",
      signedIpa: signing === "ios"
        ? {
            enabled: true,
            teamId: "ABCDE12345",
            bundleId: "com.example.app",
            exportMethod: "app-store",
          }
        : {
            enabled: false,
            teamId: "",
            bundleId: "",
            exportMethod: "app-store",
          },
    },
  };
}

describe("signing service", () => {
  it("does not require signing status for unsigned pipelines", async () => {
    const gateway = createGateway();
    gateway.failListWith(new Error("must not read"));
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.assertFlutterSigningReady(
        "example",
        "app",
        flutterConfig("none"),
      ),
    ).resolves.toBeUndefined();
  });

  it("blocks a signed pipeline when credentials are incomplete", async () => {
    const service = createSigningService(
      createGateway([
        SIGNING_SECRET_NAMES.android.keystore,
      ]),
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.assertFlutterSigningReady(
        "example",
        "app",
        flutterConfig("android"),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining(
        "Android signing credentials are missing",
      ),
    });
  });

  it("allows a signed pipeline when the selected platform is ready", async () => {
    const service = createSigningService(
      createGateway(IOS_SIGNING_SECRET_NAMES),
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.assertFlutterSigningReady(
        "example",
        "app",
        flutterConfig("ios"),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      label: "all Android secrets",
      names: ANDROID_SIGNING_SECRET_NAMES,
      platform: "android",
      configured: true,
    },
    {
      label: "partial Android secrets",
      names: [SIGNING_SECRET_NAMES.android.keystore],
      platform: "android",
      configured: false,
    },
    {
      label: "all iOS secrets",
      names: IOS_SIGNING_SECRET_NAMES,
      platform: "ios",
      configured: true,
    },
    {
      label: "partial iOS secrets",
      names: [SIGNING_SECRET_NAMES.ios.certificate],
      platform: "ios",
      configured: false,
    },
  ] as const)(
    "reports $label without returning values",
    async ({ names, platform, configured }) => {
      const gateway = createGateway(names);
      const service = createSigningService(
        gateway,
        encryptSecret,
        inspectReadiness,
      );

      const status =
        await service.getRepositorySigningStatus(
          "example",
          "app",
        );

      expect(status[platform].credentialsReady)
        .toBe(configured);
      expect(JSON.stringify(status))
        .not.toContain("synthetic-signing-value");
    },
  );

  it("encrypts and uploads every Android credential", async () => {
    const gateway = createGateway();
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    const status =
      await service.saveAndroidSigningCredentials(
        "example",
        "app",
        {
          keystoreBase64: "c3ludGhldGljLWtleXN0b3Jl",
          storePassword: "store-secret",
          keyPassword: "key-secret",
          keyAlias: "release",
        },
      );

    expect(gateway.writes.map(({ name }) => name))
      .toEqual([...ANDROID_SIGNING_SECRET_NAMES]);
    expect(gateway.writes.every(
      ({ encryptedValue }) =>
        encryptedValue.startsWith("sealed-") &&
        !encryptedValue.includes("secret"),
    )).toBe(true);
    expect(status.android.credentialsReady).toBe(true);
  });

  it("uploads every iOS credential", async () => {
    const gateway = createGateway();
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    const status =
      await service.saveIosSigningCredentials(
        "example",
        "app",
        {
          certificateP12Base64: "c3ludGhldGljLXAxMg==",
          certificatePassword: "certificate-secret",
          provisioningProfileBase64:
            "c3ludGhldGljLXByb2ZpbGU=",
        },
      );

    expect(gateway.writes.map(({ name }) => name))
      .toEqual([...IOS_SIGNING_SECRET_NAMES]);
    expect(status.ios.credentialsReady).toBe(true);
  });

  it("reports a partial update without exposing values", async () => {
    const gateway = createGateway();
    gateway.failWriteAt(
      SIGNING_SECRET_NAMES.android.keyPassword,
    );
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    const operation =
      service.saveAndroidSigningCredentials(
        "example",
        "app",
        {
          keystoreBase64: "c3ludGhldGljLWtleXN0b3Jl",
          storePassword: "store-secret",
          keyPassword: "key-secret",
          keyAlias: "release",
        },
      );

    await expect(operation).rejects.toMatchObject({
      statusCode: 403,
      partialUpdate: true,
      updatedSecrets: [
        SIGNING_SECRET_NAMES.android.keystore,
        SIGNING_SECRET_NAMES.android.storePassword,
      ],
    });
    await expect(operation).rejects.not.toThrow(
      "key-secret",
    );
  });

  it("deletes platform secrets idempotently", async () => {
    const gateway = createGateway([
      SIGNING_SECRET_NAMES.android.keystore,
    ]);
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    const status =
      await service.deleteAndroidSigningCredentials(
        "example",
        "app",
      );

    expect(gateway.deleted)
      .toEqual([...ANDROID_SIGNING_SECRET_NAMES]);
    expect(status.android.credentialsReady).toBe(false);
  });

  it("distinguishes a completed upload from a failed status refresh", async () => {
    const gateway = createGateway();
    gateway.failListWith(
      Object.assign(new Error("forbidden"), {
        status: 403,
      }),
    );
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.saveIosSigningCredentials(
        "example",
        "app",
        {
          certificateP12Base64: "c3ludGhldGljLXAxMg==",
          certificatePassword: "certificate-secret",
          provisioningProfileBase64:
            "c3ludGhldGljLXByb2ZpbGU=",
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      partialUpdate: false,
      mutationCompleted: true,
      updatedSecrets: [
        ...IOS_SIGNING_SECRET_NAMES,
      ],
      message: expect.stringContaining(
        "were updated, but the refreshed status",
      ),
    });
  });

  it("returns an actionable permission error", async () => {
    const gateway = createGateway();
    gateway.failListWith(
      Object.assign(new Error("forbidden"), {
        status: 403,
      }),
    );
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.getRepositorySigningStatus(
        "example",
        "app",
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          "Repository Secrets read permission",
        ),
        statusCode: 403,
      }),
    );
  });

  it("distinguishes authentication failure from missing secret permissions", async () => {
    const gateway = createGateway();
    gateway.failListWith(
      Object.assign(new Error("bad credentials"), {
        status: 401,
      }),
    );
    const service = createSigningService(
      gateway,
      encryptSecret,
      inspectReadiness,
    );

    await expect(
      service.getRepositorySigningStatus(
        "example",
        "app",
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          "GitHub authentication failed",
        ),
        statusCode: 401,
      }),
    );
  });

  it("uses a typed service error for safe route handling", () => {
    const error = new SigningServiceError(
      "safe",
      { statusCode: 502 },
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("safe");
  });
});
