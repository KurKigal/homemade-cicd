import { z } from "zod";

/**
 * GitHub Actions limits an individual secret value to 48 KiB.
 * File credentials are already base64 encoded when they reach the API, so
 * the encoded value itself must fit within this boundary.
 */
export const GITHUB_ACTIONS_SECRET_MAX_BYTES =
  48 * 1024;

export const SIGNING_SECRET_NAMES = {
  android: {
    keystore:
      "HOMEMADE_ANDROID_KEYSTORE_BASE64",
    storePassword:
      "HOMEMADE_ANDROID_STORE_PASSWORD",
    keyPassword:
      "HOMEMADE_ANDROID_KEY_PASSWORD",
    keyAlias:
      "HOMEMADE_ANDROID_KEY_ALIAS",
  },
  ios: {
    certificate:
      "HOMEMADE_IOS_CERTIFICATE_P12_BASE64",
    certificatePassword:
      "HOMEMADE_IOS_CERTIFICATE_PASSWORD",
    provisioningProfile:
      "HOMEMADE_IOS_PROVISIONING_PROFILE_BASE64",
  },
} as const;

export const ANDROID_SIGNING_SECRET_NAMES = [
  SIGNING_SECRET_NAMES.android.keystore,
  SIGNING_SECRET_NAMES.android.storePassword,
  SIGNING_SECRET_NAMES.android.keyPassword,
  SIGNING_SECRET_NAMES.android.keyAlias,
] as const;

export const IOS_SIGNING_SECRET_NAMES = [
  SIGNING_SECRET_NAMES.ios.certificate,
  SIGNING_SECRET_NAMES.ios.certificatePassword,
  SIGNING_SECRET_NAMES.ios.provisioningProfile,
] as const;

export const iosExportMethodSchema = z.enum([
  "app-store",
  "ad-hoc",
  "development",
]);

export type IosExportMethod =
  z.infer<typeof iosExportMethodSchema>;

export const iosTeamIdSchema = z.string()
  .trim()
  .regex(
    /^[A-Z0-9]{10}$/u,
    "Team ID must contain exactly 10 uppercase letters or digits.",
  );

export const iosBundleIdSchema = z.string()
  .trim()
  .regex(
    /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/u,
    "Bundle ID must use a reverse-DNS format such as com.example.app.",
  );

export const androidSigningConfigSchema = z.object({
  enabled: z.boolean(),
}).strict();

export type AndroidSigningConfig =
  z.infer<typeof androidSigningConfigSchema>;

export const iosSignedIpaConfigSchema =
  z.discriminatedUnion("enabled", [
    z.object({
      enabled: z.literal(false),
      teamId: z.string(),
      bundleId: z.string(),
      exportMethod: iosExportMethodSchema,
    }).strict(),
    z.object({
      enabled: z.literal(true),
      teamId: iosTeamIdSchema,
      bundleId: iosBundleIdSchema,
      exportMethod: iosExportMethodSchema,
    }).strict(),
  ]);

export type IosSignedIpaConfig =
  z.infer<typeof iosSignedIpaConfigSchema>;

function utf8ByteLength(value: string): number {
  return new TextEncoder()
    .encode(value)
    .byteLength;
}

function fitsGitHubSecretLimit(
  value: string,
): boolean {
  return utf8ByteLength(value) <=
    GITHUB_ACTIONS_SECRET_MAX_BYTES;
}

const secretValueSchema = z.string()
  .min(1, "Secret value is required.")
  .refine(fitsGitHubSecretLimit, {
    message:
      "Secret value exceeds GitHub Actions' 48 KB limit.",
  });

const base64SecretValueSchema = secretValueSchema
  .refine(
    (value) =>
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
        .test(value),
    {
      message:
        "File credential must be a valid base64 value.",
    },
  );

const keyAliasSecretValueSchema = z.string()
  .trim()
  .min(1, "Key alias is required.")
  .refine(fitsGitHubSecretLimit, {
    message:
      "Secret value exceeds GitHub Actions' 48 KB limit.",
  });

export const androidSigningCredentialsRequestSchema =
  z.object({
    keystoreBase64: base64SecretValueSchema,
    storePassword: secretValueSchema,
    keyPassword: secretValueSchema,
    keyAlias: keyAliasSecretValueSchema,
  }).strict();

export type AndroidSigningCredentialsRequest =
  z.infer<
    typeof androidSigningCredentialsRequestSchema
  >;

export const iosSigningCredentialsRequestSchema =
  z.object({
    certificateP12Base64:
      base64SecretValueSchema,
    certificatePassword: secretValueSchema,
    provisioningProfileBase64:
      base64SecretValueSchema,
  }).strict();

export type IosSigningCredentialsRequest =
  z.infer<typeof iosSigningCredentialsRequestSchema>;

export const androidSigningSecretsStatusSchema =
  z.object({
    keystore: z.boolean(),
    storePassword: z.boolean(),
    keyPassword: z.boolean(),
    keyAlias: z.boolean(),
  }).strict();

export type AndroidSigningSecretsStatus =
  z.infer<
    typeof androidSigningSecretsStatusSchema
  >;

export const iosSigningSecretsStatusSchema =
  z.object({
    certificate: z.boolean(),
    certificatePassword: z.boolean(),
    provisioningProfile: z.boolean(),
  }).strict();

export type IosSigningSecretsStatus =
  z.infer<typeof iosSigningSecretsStatusSchema>;

export const repositorySigningSecretsStatusSchema =
  z.object({
    android: androidSigningSecretsStatusSchema,
    ios: iosSigningSecretsStatusSchema,
  }).strict();

export type RepositorySigningSecretsStatus =
  z.infer<
    typeof repositorySigningSecretsStatusSchema
  >;

export const androidSigningStatusSchema = z.object({
  platformPresent: z.boolean(),
  projectReady: z.boolean(),
  credentialsReady: z.boolean(),
  ready: z.boolean(),
  issues: z.array(z.string()),
  secrets: androidSigningSecretsStatusSchema,
}).strict();

export type AndroidSigningStatus =
  z.infer<typeof androidSigningStatusSchema>;

export const iosSigningStatusSchema = z.object({
  platformPresent: z.boolean(),
  projectReady: z.boolean(),
  credentialsReady: z.boolean(),
  ready: z.boolean(),
  issues: z.array(z.string()),
  detectedTeamId: z.string().nullable(),
  detectedBundleId: z.string().nullable(),
  secrets: iosSigningSecretsStatusSchema,
}).strict();

export type IosSigningStatus =
  z.infer<typeof iosSigningStatusSchema>;

export const repositorySigningStatusSchema =
  z.object({
    android: androidSigningStatusSchema,
    ios: iosSigningStatusSchema,
  }).strict();

export type RepositorySigningStatus =
  z.infer<typeof repositorySigningStatusSchema>;
