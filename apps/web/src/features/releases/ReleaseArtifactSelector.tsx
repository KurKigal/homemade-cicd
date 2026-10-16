import type {
  WorkflowArtifact,
} from "@homemade-cicd/core";

import {
  RELEASE_ARTIFACT_MAX_BYTES,
} from "@homemade-cicd/core";

import {
  Archive,
} from "lucide-react";

interface ReleaseArtifactSelectorProps {
  artifacts: WorkflowArtifact[];
  selectedArtifactIds: ReadonlySet<number>;
  isLoading: boolean;
  errorMessage?: string;
  onToggle: (artifactId: number, selected: boolean) => void;
}

export function ReleaseArtifactSelector({
  artifacts,
  selectedArtifactIds,
  isLoading,
  errorMessage,
  onToggle,
}: ReleaseArtifactSelectorProps) {
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium text-zinc-200">
        Release assets
      </legend>

      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Select artifacts explicitly. Each Actions artifact is attached as a
        ZIP asset, up to {formatBinarySize(RELEASE_ARTIFACT_MAX_BYTES)}.
      </p>

      {isLoading ? (
        <div className="mt-3 rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
          Loading workflow artifacts...
        </div>
      ) : errorMessage ? (
        <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-400">
          <p>{errorMessage}</p>
          <p className="mt-2 text-xs text-red-300">
            You can still create this release without assets.
          </p>
        </div>
      ) : artifacts.length === 0 ? (
        <div className="mt-3 rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
          This run did not produce any artifacts. An asset-free release is
          still valid.
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {artifacts.map((artifact) => {
            const exceedsLimit =
              artifact.sizeInBytes > RELEASE_ARTIFACT_MAX_BYTES;
            const selectable = !artifact.expired && !exceedsLimit;

            return (
              <label
                key={artifact.id}
                className={[
                  "flex gap-3 rounded-lg border p-4",
                  selectable
                    ? "cursor-pointer border-zinc-800 bg-zinc-950/50"
                    : "cursor-not-allowed border-zinc-900 bg-zinc-950/20 opacity-60",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selectedArtifactIds.has(artifact.id)}
                  disabled={!selectable}
                  onChange={(event) =>
                    onToggle(artifact.id, event.target.checked)
                  }
                  className="mt-1 accent-zinc-100"
                />

                <Archive
                  size={18}
                  className="mt-0.5 shrink-0 text-zinc-500"
                />

                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {artifact.name}.zip
                  </span>

                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{formatBinarySize(artifact.sizeInBytes)}</span>

                    {artifact.expired && (
                      <span className="text-red-400">Expired</span>
                    )}

                    {exceedsLimit && (
                      <span className="text-amber-400">
                        Exceeds release asset limit
                      </span>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function formatBinarySize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KiB", "MiB", "GiB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, unitIndex);

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
