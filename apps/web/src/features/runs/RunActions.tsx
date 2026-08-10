import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  WorkflowRun,
} from "@homemade-cicd/core";

import {
  RefreshCw,
  RotateCcw,
  Square,
} from "lucide-react";

import {
  api,
} from "../../lib/api";

interface RunActionsProps {
  owner: string;
  repo: string;
  run: WorkflowRun;
}

export function RunActions({
  owner,
  repo,
  run,
}: RunActionsProps) {
  const queryClient =
    useQueryClient();

  async function refreshRunData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          "github",
          "run",
          owner,
          repo,
          run.id,
        ],
      }),

      queryClient.invalidateQueries({
        queryKey: [
          "github",
          "run-jobs",
          owner,
          repo,
          run.id,
        ],
      }),

      queryClient.invalidateQueries({
        queryKey: [
          "github",
          "runs",
          owner,
          repo,
        ],
      }),
    ]);
  }

  const rerunMutation =
    useMutation({
      mutationFn: () =>
        api.github.rerunWorkflow(
          owner,
          repo,
          run.id,
        ),

      onSuccess: refreshRunData,
    });

  const rerunFailedMutation =
    useMutation({
      mutationFn: () =>
        api.github.rerunFailedWorkflow(
          owner,
          repo,
          run.id,
        ),

      onSuccess: refreshRunData,
    });

  const cancelMutation =
    useMutation({
      mutationFn: () =>
        api.github.cancelWorkflow(
          owner,
          repo,
          run.id,
        ),

      onSuccess: refreshRunData,
    });

  const isCompleted =
    run.status === "completed";

  const isFailed =
    isCompleted &&
    run.conclusion === "failure";

  const canCancel = !isCompleted;

  const isPending =
    rerunMutation.isPending ||
    rerunFailedMutation.isPending ||
    cancelMutation.isPending;

  const error =
    rerunMutation.error ??
    rerunFailedMutation.error ??
    cancelMutation.error;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {isCompleted && (
          <button
            type="button"
            onClick={() =>
              rerunMutation.mutate()
            }
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-900 disabled:opacity-50"
          >
            <RotateCcw size={15} />
            Re-run
          </button>
        )}

        {isFailed && (
          <button
            type="button"
            onClick={() =>
              rerunFailedMutation.mutate()
            }
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-900 disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Re-run Failed
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() =>
              cancelMutation.mutate()
            }
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/30 disabled:opacity-50"
          >
            <Square size={14} />
            Cancel
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">
          {error.message}
        </p>
      )}

      {rerunMutation.isSuccess && (
        <p className="mt-3 text-sm text-emerald-400">
          {rerunMutation.data.message}
        </p>
      )}

      {rerunFailedMutation.isSuccess && (
        <p className="mt-3 text-sm text-emerald-400">
          {
            rerunFailedMutation.data
              .message
          }
        </p>
      )}

      {cancelMutation.isSuccess && (
        <p className="mt-3 text-sm text-emerald-400">
          {cancelMutation.data.message}
        </p>
      )}
    </div>
  );
}