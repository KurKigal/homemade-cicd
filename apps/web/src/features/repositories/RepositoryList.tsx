import type {
  Repository,
} from "@homemade-cicd/core";

import {
  RepositoryCard,
} from "./RepositoryCard";

import type {
  SelectedRepository,
} from "./types";

interface RepositoryListProps {
  repositories: Repository[];

  onSelect: (
    repository: SelectedRepository,
  ) => void;
}

export function RepositoryList({
  repositories,
  onSelect,
}: RepositoryListProps) {
  if (repositories.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        No repositories match your search.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {repositories.map((repository) => (
        <RepositoryCard
          key={repository.id}
          repository={repository}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}