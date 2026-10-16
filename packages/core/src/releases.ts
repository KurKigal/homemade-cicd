import { z } from "zod";

/**
 * Release asset archives are bounded before download so the API never buffers
 * an arbitrarily large GitHub Actions artifact in memory.
 */
export const RELEASE_ARTIFACT_MAX_BYTES =
  100 * 1024 * 1024;

export interface ReleaseAuthor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface ReleaseAsset {
  id: number;
  name: string;
  sizeInBytes: number;
  downloadUrl: string;
  contentType: string;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryRelease {
  id: number;
  tagName: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
  targetCommitish: string;
  createdAt: string;
  publishedAt: string | null;
  author: ReleaseAuthor;
  assets: ReleaseAsset[];
}

export const releaseNotesModeSchema = z.enum([
  "manual",
  "generated",
]);

export type ReleaseNotesMode =
  z.infer<typeof releaseNotesModeSchema>;

export const releaseNotesSchema =
  z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("manual"),
      body: z.string(),
    }).strict(),
    z.object({
      mode: z.literal("generated"),
    }).strict(),
  ]);

export type ReleaseNotes =
  z.infer<typeof releaseNotesSchema>;

const artifactIdSchema = z.number()
  .int()
  .positive();

const artifactIdsSchema = z.array(
  artifactIdSchema,
).refine(
  (ids) => new Set(ids).size === ids.length,
  {
    message: "Artifact IDs must be unique.",
  },
);

export const releaseSourceSchema =
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("defaultBranch"),
    }).strict(),
    z.object({
      type: z.literal("workflowRun"),
      runId: z.number().int().positive(),
      artifactIds: artifactIdsSchema,
    }).strict(),
  ]);

export type ReleaseSource =
  z.infer<typeof releaseSourceSchema>;

export const createReleaseRequestSchema = z.object({
  tagName: z.string()
    .trim()
    .min(1, "Tag name is required."),
  name: z.string()
    .trim()
    .min(1, "Release name cannot be blank.")
    .optional(),
  notes: releaseNotesSchema,
  draft: z.boolean(),
  prerelease: z.boolean(),
  source: releaseSourceSchema,
}).strict();

export type CreateReleaseRequest =
  z.infer<typeof createReleaseRequestSchema>;

export interface FailedReleaseArtifact {
  artifactId: number;
  name: string;
  error: string;
}

type SuccessfulCreateReleaseResult = {
  success: true;
  partial: false;
  outcome: "published" | "draft";
  release: RepositoryRelease;
  uploadedAssets: ReleaseAsset[];
  failedArtifacts: [];
  publicationError: null;
};

type AssetUploadPartialCreateReleaseResult = {
  success: false;
  partial: true;
  outcome: "partial";
  release: RepositoryRelease;
  uploadedAssets: ReleaseAsset[];
  failedArtifacts: [
    FailedReleaseArtifact,
    ...FailedReleaseArtifact[],
  ];
  publicationError: null;
};

type PublicationPartialCreateReleaseResult = {
  success: false;
  partial: true;
  outcome: "partial";
  release: RepositoryRelease;
  uploadedAssets: ReleaseAsset[];
  failedArtifacts: [];
  publicationError: string;
};

/**
 * A partial result always points to the draft left on GitHub. It must contain
 * either at least one failed artifact or a publication error, so callers never
 * receive an unexplained partial outcome.
 */
export type CreateReleaseResult =
  | SuccessfulCreateReleaseResult
  | AssetUploadPartialCreateReleaseResult
  | PublicationPartialCreateReleaseResult;
