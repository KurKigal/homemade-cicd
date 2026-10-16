import type {
  ReleaseAsset,
  RepositoryRelease,
} from "@homemade-cicd/core";

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepositoryRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  upload_url: string;
  target_commitish: string;
  created_at: string;
  published_at: string | null;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  assets: GitHubReleaseAsset[];
}

export function mapReleaseAsset(
  asset: GitHubReleaseAsset,
): ReleaseAsset {
  return {
    id: asset.id,
    name: asset.name,
    sizeInBytes: asset.size,
    downloadUrl: asset.browser_download_url,
    contentType: asset.content_type,
    downloadCount: asset.download_count,
    createdAt: asset.created_at,
    updatedAt: asset.updated_at,
  };
}

export function mapRepositoryRelease(
  release: GitHubRepositoryRelease,
): RepositoryRelease {
  return {
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    body: release.body ?? null,
    draft: release.draft,
    prerelease: release.prerelease,
    htmlUrl: release.html_url,
    targetCommitish: release.target_commitish,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    author: {
      login: release.author.login,
      avatarUrl: release.author.avatar_url,
      profileUrl: release.author.html_url,
    },
    assets: release.assets.map(mapReleaseAsset),
  };
}
