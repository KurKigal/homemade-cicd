import type {
  AndroidSigningCredentialsRequest,
  FlutterPipelineConfig,
  IosSigningCredentialsRequest,
  RepositorySigningSecretsStatus,
  RepositorySigningStatus,
} from "@homemade-cicd/core";
import {
  ANDROID_SIGNING_SECRET_NAMES,
  IOS_SIGNING_SECRET_NAMES,
  SIGNING_SECRET_NAMES,
} from "@homemade-cicd/core";

import {
  githubAdapter,
  type RepositoryActionsPublicKey,
  type RepositorySecretMetadata,
} from "../../adapters/github/github-adapter.js";
import type {
  RepositoryReader,
} from "../repositories/repository-reader.js";
import {
  encryptRepositorySecret,
} from "./secret-encryption.js";
import {
  inspectSigningReadiness,
} from "./signing-readiness.js";

interface SigningRepositoryGateway
  extends RepositoryReader {
  listRepositorySecrets(
    owner: string,
    repo: string,
  ): Promise<RepositorySecretMetadata[]>;

  getRepositoryActionsPublicKey(
    owner: string,
    repo: string,
  ): Promise<RepositoryActionsPublicKey>;

  createOrUpdateRepositorySecret(
    owner: string,
    repo: string,
    name: string,
    encryptedValue: string,
    keyId: string,
  ): Promise<void>;

  deleteRepositorySecret(
    owner: string,
    repo: string,
    name: string,
  ): Promise<void>;
}

type SecretEncryptor = (
  publicKeyBase64: string,
  plaintext: string,
) => Promise<string>;

type ReadinessInspector = (
  reader: RepositoryReader,
  owner: string,
  repo: string,
  secrets: RepositorySigningSecretsStatus,
) => Promise<RepositorySigningStatus>;

export class SigningServiceError extends Error {
  readonly statusCode: number;
  readonly partialUpdate: boolean;
  readonly mutationCompleted: boolean;
  readonly updatedSecrets: readonly string[];
  readonly signingStatus?: RepositorySigningStatus;

  constructor(
    message: string,
    options: {
      statusCode: number;
      partialUpdate?: boolean;
      mutationCompleted?: boolean;
      updatedSecrets?: readonly string[];
      signingStatus?: RepositorySigningStatus;
    },
  ) {
    super(message);
    this.name = "SigningServiceError";
    this.statusCode = options.statusCode;
    this.partialUpdate = options.partialUpdate ?? false;
    this.mutationCompleted =
      options.mutationCompleted ?? false;
    this.updatedSecrets = options.updatedSecrets ?? [];

    if (options.signingStatus !== undefined) {
      this.signingStatus = options.signingStatus;
    }
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
  action: "read" | "write",
): SigningServiceError {
  if (error instanceof SigningServiceError) {
    return error;
  }

  const status = readHttpStatus(error);

  if (status === 401) {
    return new SigningServiceError(
      "GitHub authentication failed. Verify the configured token before managing signing credentials.",
      { statusCode: 401 },
    );
  }

  if (status === 403) {
    const access = action === "read"
      ? "read"
      : "read/write";

    return new SigningServiceError(
      `GitHub Repository Secrets ${access} permission is required for signing credentials.`,
      { statusCode: 403 },
    );
  }

  if (status === 404) {
    return new SigningServiceError(
      "The repository or its Actions Secrets endpoint could not be found.",
      { statusCode: 404 },
    );
  }

  return new SigningServiceError(
    action === "read"
      ? "GitHub signing status could not be read."
      : "GitHub signing credentials could not be updated.",
    { statusCode: 502 },
  );
}

function toSecretsStatus(
  secrets: readonly RepositorySecretMetadata[],
): RepositorySigningSecretsStatus {
  const names = new Set(
    secrets.map((secret) => secret.name.toUpperCase()),
  );

  return {
    android: {
      keystore: names.has(
        SIGNING_SECRET_NAMES.android.keystore,
      ),
      storePassword: names.has(
        SIGNING_SECRET_NAMES.android.storePassword,
      ),
      keyPassword: names.has(
        SIGNING_SECRET_NAMES.android.keyPassword,
      ),
      keyAlias: names.has(
        SIGNING_SECRET_NAMES.android.keyAlias,
      ),
    },
    ios: {
      certificate: names.has(
        SIGNING_SECRET_NAMES.ios.certificate,
      ),
      certificatePassword: names.has(
        SIGNING_SECRET_NAMES.ios.certificatePassword,
      ),
      provisioningProfile: names.has(
        SIGNING_SECRET_NAMES.ios.provisioningProfile,
      ),
    },
  };
}

export function createSigningService(
  gateway: SigningRepositoryGateway,
  encryptSecret: SecretEncryptor =
    encryptRepositorySecret,
  inspectReadiness: ReadinessInspector =
    inspectSigningReadiness,
) {
  async function readStatus(
    owner: string,
    repo: string,
  ): Promise<RepositorySigningStatus> {
    const secrets = await gateway.listRepositorySecrets(
      owner,
      repo,
    );

    return inspectReadiness(
      gateway,
      owner,
      repo,
      toSecretsStatus(secrets),
    );
  }

  async function getStatus(
    owner: string,
    repo: string,
  ): Promise<RepositorySigningStatus> {
    try {
      return await readStatus(owner, repo);
    } catch (error) {
      throw normalizeGitHubError(error, "read");
    }
  }

  async function statusAfterPartialUpdate(
    owner: string,
    repo: string,
  ): Promise<RepositorySigningStatus | undefined> {
    try {
      return await readStatus(owner, repo);
    } catch {
      return undefined;
    }
  }

  async function uploadSecrets(
    owner: string,
    repo: string,
    entries: ReadonlyArray<readonly [string, string]>,
  ): Promise<RepositorySigningStatus> {
    let publicKey: RepositoryActionsPublicKey;

    try {
      publicKey =
        await gateway.getRepositoryActionsPublicKey(
          owner,
          repo,
        );
    } catch (error) {
      throw normalizeGitHubError(error, "write");
    }

    const updatedSecrets: string[] = [];

    try {
      for (const [name, value] of entries) {
        const encryptedValue = await encryptSecret(
          publicKey.key,
          value,
        );

        await gateway.createOrUpdateRepositorySecret(
          owner,
          repo,
          name,
          encryptedValue,
          publicKey.keyId,
        );
        updatedSecrets.push(name);
      }
    } catch (error) {
      const normalized = normalizeGitHubError(
        error,
        "write",
      );
      const signingStatus =
        await statusAfterPartialUpdate(owner, repo);
      const partialUpdate = updatedSecrets.length > 0;

      throw new SigningServiceError(
        partialUpdate
          ? "Some signing credentials were updated before GitHub rejected the operation. Review the refreshed status and retry."
          : normalized.message,
        {
          statusCode: normalized.statusCode,
          partialUpdate,
          updatedSecrets,
          ...(signingStatus
            ? { signingStatus }
            : {}),
        },
      );
    }

    try {
      return await getStatus(owner, repo);
    } catch (error) {
      const normalized = normalizeGitHubError(
        error,
        "read",
      );

      throw new SigningServiceError(
        "Signing credentials were updated, but the refreshed status could not be read. Refresh status before retrying the upload.",
        {
          statusCode: normalized.statusCode,
          mutationCompleted: true,
          updatedSecrets,
        },
      );
    }
  }

  async function deleteSecrets(
    owner: string,
    repo: string,
    names: readonly string[],
  ): Promise<RepositorySigningStatus> {
    const deletedSecrets: string[] = [];

    try {
      for (const name of names) {
        await gateway.deleteRepositorySecret(
          owner,
          repo,
          name,
        );
        deletedSecrets.push(name);
      }
    } catch (error) {
      const normalized = normalizeGitHubError(
        error,
        "write",
      );
      const signingStatus =
        await statusAfterPartialUpdate(owner, repo);
      const partialUpdate = deletedSecrets.length > 0;

      throw new SigningServiceError(
        partialUpdate
          ? "Some signing credentials were removed before GitHub rejected the operation. Review the refreshed status and retry."
          : normalized.message,
        {
          statusCode: normalized.statusCode,
          partialUpdate,
          updatedSecrets: deletedSecrets,
          ...(signingStatus
            ? { signingStatus }
            : {}),
        },
      );
    }

    try {
      return await getStatus(owner, repo);
    } catch (error) {
      const normalized = normalizeGitHubError(
        error,
        "read",
      );

      throw new SigningServiceError(
        "Signing credentials were removed, but the refreshed status could not be read. Refresh status before retrying the removal.",
        {
          statusCode: normalized.statusCode,
          mutationCompleted: true,
          updatedSecrets: deletedSecrets,
        },
      );
    }
  }

  return {
    getRepositorySigningStatus: getStatus,

    async assertFlutterSigningReady(
      owner: string,
      repo: string,
      config: FlutterPipelineConfig,
    ): Promise<void> {
      const androidSigning =
        config.android.signing?.enabled === true;
      const iosSigning =
        config.ios.signedIpa?.enabled === true;

      if (!androidSigning && !iosSigning) {
        return;
      }

      const status = await getStatus(owner, repo);
      const issues = [
        ...(androidSigning && !status.android.ready
          ? status.android.issues.length > 0
            ? status.android.issues
            : ["Android signing is not ready."]
          : []),
        ...(iosSigning && !status.ios.ready
          ? status.ios.issues.length > 0
            ? status.ios.issues
            : ["iOS signing is not ready."]
          : []),
      ];

      if (issues.length > 0) {
        throw new SigningServiceError(
          `Signing is not ready: ${[...new Set(issues)].join(" ")}`,
          { statusCode: 409 },
        );
      }
    },

    saveAndroidSigningCredentials(
      owner: string,
      repo: string,
      credentials: AndroidSigningCredentialsRequest,
    ) {
      return uploadSecrets(owner, repo, [
        [
          SIGNING_SECRET_NAMES.android.keystore,
          credentials.keystoreBase64,
        ],
        [
          SIGNING_SECRET_NAMES.android.storePassword,
          credentials.storePassword,
        ],
        [
          SIGNING_SECRET_NAMES.android.keyPassword,
          credentials.keyPassword,
        ],
        [
          SIGNING_SECRET_NAMES.android.keyAlias,
          credentials.keyAlias,
        ],
      ]);
    },

    deleteAndroidSigningCredentials(
      owner: string,
      repo: string,
    ) {
      return deleteSecrets(
        owner,
        repo,
        ANDROID_SIGNING_SECRET_NAMES,
      );
    },

    saveIosSigningCredentials(
      owner: string,
      repo: string,
      credentials: IosSigningCredentialsRequest,
    ) {
      return uploadSecrets(owner, repo, [
        [
          SIGNING_SECRET_NAMES.ios.certificate,
          credentials.certificateP12Base64,
        ],
        [
          SIGNING_SECRET_NAMES.ios.certificatePassword,
          credentials.certificatePassword,
        ],
        [
          SIGNING_SECRET_NAMES.ios.provisioningProfile,
          credentials.provisioningProfileBase64,
        ],
      ]);
    },

    deleteIosSigningCredentials(
      owner: string,
      repo: string,
    ) {
      return deleteSecrets(
        owner,
        repo,
        IOS_SIGNING_SECRET_NAMES,
      );
    },
  };
}

const signingService = createSigningService(
  githubAdapter,
);

export const {
  getRepositorySigningStatus,
  assertFlutterSigningReady,
  saveAndroidSigningCredentials,
  deleteAndroidSigningCredentials,
  saveIosSigningCredentials,
  deleteIosSigningCredentials,
} = signingService;
