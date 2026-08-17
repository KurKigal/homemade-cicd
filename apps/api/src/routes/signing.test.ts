import Fastify from "fastify";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "../services/signing/signing-service.js",
  () => {
    class MockSigningServiceError extends Error {
      statusCode: number;
      partialUpdate: boolean;
      mutationCompleted: boolean;
      updatedSecrets: readonly string[];
      signingStatus?: unknown;

      constructor(
        message: string,
        options: {
          statusCode: number;
          partialUpdate?: boolean;
          mutationCompleted?: boolean;
          updatedSecrets?: readonly string[];
          signingStatus?: unknown;
        },
      ) {
        super(message);
        this.statusCode = options.statusCode;
        this.partialUpdate =
          options.partialUpdate ?? false;
        this.mutationCompleted =
          options.mutationCompleted ?? false;
        this.updatedSecrets =
          options.updatedSecrets ?? [];

        if (options.signingStatus !== undefined) {
          this.signingStatus = options.signingStatus;
        }
      }
    }

    return {
      deleteAndroidSigningCredentials: vi.fn(),
      deleteIosSigningCredentials: vi.fn(),
      getRepositorySigningStatus: vi.fn(),
      saveAndroidSigningCredentials: vi.fn(),
      saveIosSigningCredentials: vi.fn(),
      SigningServiceError: MockSigningServiceError,
    };
  },
);

import {
  deleteAndroidSigningCredentials,
  deleteIosSigningCredentials,
  getRepositorySigningStatus,
  saveAndroidSigningCredentials,
  saveIosSigningCredentials,
  SigningServiceError,
} from "../services/signing/signing-service.js";
import {
  signingRoutes,
} from "./signing.js";

const signingStatus = {
  android: {
    platformPresent: true,
    projectReady: true,
    credentialsReady: true,
    ready: true,
    issues: [],
    secrets: {
      keystore: true,
      storePassword: true,
      keyPassword: true,
      keyAlias: true,
    },
  },
  ios: {
    platformPresent: true,
    projectReady: true,
    credentialsReady: false,
    ready: false,
    issues: ["iOS signing credentials are missing."],
    detectedTeamId: "ABCDE12345",
    detectedBundleId: "com.example.app",
    secrets: {
      certificate: false,
      certificatePassword: false,
      provisioningProfile: false,
    },
  },
};

async function createApp() {
  const app = Fastify();
  await app.register(signingRoutes);
  return app;
}

describe("signing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRepositorySigningStatus)
      .mockResolvedValue(signingStatus);
    vi.mocked(saveAndroidSigningCredentials)
      .mockResolvedValue(signingStatus);
    vi.mocked(saveIosSigningCredentials)
      .mockResolvedValue(signingStatus);
    vi.mocked(deleteAndroidSigningCredentials)
      .mockResolvedValue(signingStatus);
    vi.mocked(deleteIosSigningCredentials)
      .mockResolvedValue(signingStatus);
  });

  it("returns status metadata without secret values", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/github/repos/example/app/signing",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(signingStatus);
      expect(response.body).not.toContain("password-value");
      expect(getRepositorySigningStatus)
        .toHaveBeenCalledWith("example", "app");
    } finally {
      await app.close();
    }
  });

  it("validates and saves Android credentials", async () => {
    const app = await createApp();
    const payload = {
      keystoreBase64: "c3ludGhldGljLWtleXN0b3Jl",
      storePassword: "store-password",
      keyPassword: "key-password",
      keyAlias: "release",
    };

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/app/signing/android",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(saveAndroidSigningCredentials)
        .toHaveBeenCalledWith(
          "example",
          "app",
          payload,
        );
      expect(response.body).not.toContain(
        payload.storePassword,
      );
    } finally {
      await app.close();
    }
  });

  it("validates and saves iOS credentials", async () => {
    const app = await createApp();
    const payload = {
      certificateP12Base64: "c3ludGhldGljLXAxMg==",
      certificatePassword: "certificate-password",
      provisioningProfileBase64:
        "c3ludGhldGljLXByb2ZpbGU=",
    };

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/app/signing/ios",
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(saveIosSigningCredentials)
        .toHaveBeenCalledWith(
          "example",
          "app",
          payload,
        );
      expect(response.body).not.toContain(
        payload.certificatePassword,
      );
    } finally {
      await app.close();
    }
  });

  it.each([
    {
      label: "missing fields",
      payload: {
        keystoreBase64: "c3ludGhldGlj",
      },
    },
    {
      label: "invalid base64",
      payload: {
        keystoreBase64: "not base64!",
        storePassword: "store",
        keyPassword: "key",
        keyAlias: "release",
      },
    },
    {
      label: "empty password",
      payload: {
        keystoreBase64: "c3ludGhldGlj",
        storePassword: "",
        keyPassword: "key",
        keyAlias: "release",
      },
    },
    {
      label: "oversized credential",
      payload: {
        keystoreBase64: "A".repeat(48 * 1024 + 4),
        storePassword: "store",
        keyPassword: "key",
        keyAlias: "release",
      },
    },
  ])("rejects Android $label", async ({ payload }) => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/app/signing/android",
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(saveAndroidSigningCredentials)
        .not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects an invalid repository owner", async () => {
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/github/repos/%20/app/signing",
      });

      expect(response.statusCode).toBe(400);
      expect(getRepositorySigningStatus)
        .not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    ["android", deleteAndroidSigningCredentials],
    ["ios", deleteIosSigningCredentials],
  ] as const)(
    "deletes %s credentials",
    async (platform, deleteCredentials) => {
      const app = await createApp();

      try {
        const response = await app.inject({
          method: "DELETE",
          url: `/github/repos/example/app/signing/${platform}`,
        });

        expect(response.statusCode).toBe(200);
        expect(deleteCredentials)
          .toHaveBeenCalledWith("example", "app");
      } finally {
        await app.close();
      }
    },
  );

  it("returns actionable permission errors", async () => {
    vi.mocked(getRepositorySigningStatus)
      .mockRejectedValueOnce(
        new SigningServiceError(
          "GitHub Repository Secrets read permission is required for signing credentials.",
          { statusCode: 403 },
        ),
      );
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/github/repos/example/app/signing",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: expect.stringContaining(
          "Repository Secrets read permission",
        ),
      });
    } finally {
      await app.close();
    }
  });

  it("reports partial writes with only non-secret metadata", async () => {
    vi.mocked(saveAndroidSigningCredentials)
      .mockRejectedValueOnce(
        new SigningServiceError(
          "Some signing credentials were updated.",
          {
            statusCode: 502,
            partialUpdate: true,
            updatedSecrets: [
              "HOMEMADE_ANDROID_KEYSTORE_BASE64",
            ],
            signingStatus,
          },
        ),
      );
    const app = await createApp();
    const plaintext = "must-not-be-returned";

    try {
      const response = await app.inject({
        method: "PUT",
        url: "/github/repos/example/app/signing/android",
        payload: {
          keystoreBase64: "c3ludGhldGljLWtleXN0b3Jl",
          storePassword: plaintext,
          keyPassword: "key-password",
          keyAlias: "release",
        },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        partialUpdate: true,
        updatedSecrets: [
          "HOMEMADE_ANDROID_KEYSTORE_BASE64",
        ],
        signingStatus,
      });
      expect(response.body).not.toContain(plaintext);
    } finally {
      await app.close();
    }
  });
});
