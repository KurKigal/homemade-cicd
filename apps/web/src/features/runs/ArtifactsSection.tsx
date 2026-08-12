import type {
  WorkflowArtifact,
} from "@homemade-cicd/core";

import {
  ArtifactCard,
} from "./ArtifactCard";

interface ArtifactsSectionProps {
  owner: string;
  repo: string;

  artifacts: WorkflowArtifact[];

  isLoading: boolean;

  errorMessage?: string;
}

export function ArtifactsSection({
  owner,
  repo,
  artifacts,
  isLoading,
  errorMessage,
}: ArtifactsSectionProps) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Artifacts
        </h3>

        <p className="mt-1 text-sm text-zinc-500">
          Files produced by this
          workflow run.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
          Loading artifacts...
        </div>
      ) : errorMessage ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
          {errorMessage}
        </div>
      ) : artifacts.length > 0 ? (
        <div className="grid gap-3">
          {artifacts.map(
            (artifact) => (
              <ArtifactCard
                key={artifact.id}
                owner={owner}
                repo={repo}
                artifact={artifact}
              />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
          No artifacts were produced
          by this workflow run.
        </div>
      )}
    </section>
  );
}