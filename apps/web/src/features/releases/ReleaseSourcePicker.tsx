import type {
  ReleaseSource,
  WorkflowRun,
} from "@homemade-cicd/core";

interface ReleaseSourcePickerProps {
  sourceType: ReleaseSource["type"];
  defaultBranch: string;
  runs: WorkflowRun[];
  selectedRunId: number | null;
  selectedRun?: WorkflowRun;
  isLoading: boolean;
  errorMessage?: string;
  onSourceTypeChange: (sourceType: ReleaseSource["type"]) => void;
  onRunChange: (runId: number | null) => void;
}

export function ReleaseSourcePicker({
  sourceType,
  defaultBranch,
  runs,
  selectedRunId,
  selectedRun,
  isLoading,
  errorMessage,
  onSourceTypeChange,
  onRunChange,
}: ReleaseSourcePickerProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-200">
        Release source
      </legend>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <input
            type="radio"
            name="release-source"
            value="defaultBranch"
            checked={sourceType === "defaultBranch"}
            onChange={() => onSourceTypeChange("defaultBranch")}
            className="mt-0.5 accent-zinc-100"
          />

          <span>
            <span className="block text-sm font-medium">
              Default branch
            </span>

            <span className="mt-1 block break-all text-xs text-zinc-500">
              Target {defaultBranch}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <input
            type="radio"
            name="release-source"
            value="workflowRun"
            checked={sourceType === "workflowRun"}
            onChange={() => onSourceTypeChange("workflowRun")}
            className="mt-0.5 accent-zinc-100"
          />

          <span>
            <span className="block text-sm font-medium">
              Successful workflow run
            </span>

            <span className="mt-1 block text-xs text-zinc-500">
              Release the exact built commit.
            </span>
          </span>
        </label>
      </div>

      {sourceType === "workflowRun" && (
        <div className="mt-4">
          <label
            htmlFor="release-run"
            className="mb-2 block text-sm text-zinc-300"
          >
            Successful run
          </label>

          {isLoading ? (
            <div className="rounded-lg border border-zinc-800 p-4 text-sm text-zinc-500">
              Loading successful runs...
            </div>
          ) : errorMessage ? (
            <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-400">
              {errorMessage}
            </div>
          ) : (
            <select
              id="release-run"
              value={selectedRunId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onRunChange(value ? Number(value) : null);
              }}
              className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-600"
            >
              <option value="">Select a successful run</option>

              {runs.map((run) => (
                <option
                  key={run.id}
                  value={run.id}
                >
                  {formatRunOption(run)}
                </option>
              ))}
            </select>
          )}

          {!isLoading && !errorMessage && runs.length === 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              No completed successful runs are available.
            </p>
          )}

          {selectedRun && (
            <div className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                Release commit
              </p>

              <code className="mt-1 block break-all text-sm text-emerald-200">
                {selectedRun.headSha}
              </code>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

function formatRunOption(run: WorkflowRun): string {
  const branch = run.headBranch ?? "unknown branch";
  const shortSha = run.headSha.slice(0, 7);
  const date = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(new Date(run.createdAt));

  return `${run.workflowName} #${run.runNumber} · ${branch} · ${shortSha} · ${date}`;
}
