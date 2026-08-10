import type {
  Repository,
} from "@homemade-cicd/core";

import {
  ChevronRight,
  GitBranch,
  Lock,
  Unlock,
} from "lucide-react";

import type {
  SelectedRepository,
} from "./types";

interface RepositoryCardProps {
  repository: Repository;

  onSelect: (
    repository: SelectedRepository,
  ) => void;
}

function formatUpdatedAt(
  date: string | null,
) {
  if (!date) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function RepositoryCard({
  repository,
  onSelect,
}: RepositoryCardProps) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect({
          owner: repository.owner.login,
          name: repository.name,
          defaultBranch:
            repository.defaultBranch,
        })
      }
      className="group flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-medium text-zinc-100">
            {repository.name}
          </h3>

          <span className="flex items-center gap-1 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
            {repository.private ? (
              <Lock size={11} />
            ) : (
              <Unlock size={11} />
            )}

            {repository.private
              ? "Private"
              : "Public"}
          </span>

          {repository.language && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {repository.language}
            </span>
          )}
        </div>

        <p className="mt-2 max-w-3xl truncate text-sm text-zinc-500">
          {repository.description ??
            "No repository description"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
          <span className="flex items-center gap-1.5">
            <GitBranch size={13} />
            {repository.defaultBranch}
          </span>

          <span>
            Updated{" "}
            {formatUpdatedAt(
              repository.updatedAt,
            )}
          </span>
        </div>
      </div>

      <ChevronRight
        size={20}
        className="ml-5 shrink-0 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300"
      />
    </button>
  );
}