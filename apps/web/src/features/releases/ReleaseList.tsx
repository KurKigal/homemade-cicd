import type {
  RepositoryRelease,
} from "@homemade-cicd/core";

import {
  ExternalLink,
  PackageOpen,
} from "lucide-react";

interface ReleaseListProps {
  releases: RepositoryRelease[];
  isLoading: boolean;
  errorMessage?: string;
}

export function ReleaseList({
  releases,
  isLoading,
  errorMessage,
}: ReleaseListProps) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30">
      <div className="border-b border-zinc-800 p-5">
        <h3 className="font-semibold">
          Existing releases
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          GitHub-native releases for this repository.
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-zinc-500">
          Loading releases...
        </div>
      ) : errorMessage ? (
        <div className="m-5 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      ) : releases.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-500">
          No GitHub releases found for this repository.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {releases.map((release) => (
            <article
              key={release.id}
              className="p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReleaseStatusBadges
                      draft={release.draft}
                      prerelease={release.prerelease}
                    />
                  </div>

                  <h4 className="mt-3 break-words font-medium">
                    {release.name?.trim() || release.tagName}
                  </h4>

                  <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                    {release.tagName}
                  </p>
                </div>

                <a
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${release.tagName} on GitHub`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                >
                  <ExternalLink size={15} />
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
                <span>
                  {formatDate(release.publishedAt ?? release.createdAt)}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <PackageOpen size={13} />
                  {release.assets.length}{" "}
                  {release.assets.length === 1 ? "asset" : "assets"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReleaseStatusBadges({
  draft,
  prerelease,
}: {
  draft: boolean;
  prerelease: boolean;
}) {
  return (
    <>
      {draft ? (
        <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
          Draft
        </span>
      ) : prerelease ? (
        <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs text-violet-300">
          Prerelease
        </span>
      ) : (
        <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
          Published
        </span>
      )}

      {draft && prerelease && (
        <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs text-violet-300">
          Prerelease
        </span>
      )}
    </>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}
