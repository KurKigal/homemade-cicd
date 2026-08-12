import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  ExternalLink,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";

import {
  api,
} from "../../lib/api";

import { queryKeys } from "../../lib/query-keys";

import {
  PipelineBuilder,
} from "./PipelineBuilder";

interface PipelineDetailsPanelProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  workflowId: number;
}

export function PipelineDetailsPanel({
  owner,
  repo,
  defaultBranch,
  workflowId,
}: PipelineDetailsPanelProps) {
  const queryClient =
    useQueryClient();

  const detailsQuery =
    useQuery({
      queryKey: queryKeys.pipeline(owner, repo, workflowId),

      queryFn: () =>
        api.github.pipelineDetails(
          owner,
          repo,
          workflowId,
        ),
    });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.pipelines(owner, repo),
      }),

      queryClient.invalidateQueries({
        queryKey: queryKeys.pipeline(owner, repo, workflowId),
      }),
    ]);
  }

  const enableMutation =
    useMutation({
      mutationFn: () =>
        api.github.enablePipeline(
          owner,
          repo,
          workflowId,
        ),

      onSuccess:
        refresh,
    });

  const disableMutation =
    useMutation({
      mutationFn: () =>
        api.github.disablePipeline(
          owner,
          repo,
          workflowId,
        ),

      onSuccess:
        refresh,
    });

  const deleteMutation =
    useMutation({
      mutationFn: () =>
        api.github.deletePipeline(
          owner,
          repo,
          workflowId,
        ),

      onSuccess:
        refresh,
    });

  if (detailsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
        Loading pipeline...
      </div>
    );
  }

  if (
    detailsQuery.isError ||
    !detailsQuery.data
  ) {
    return (
      <div className="rounded-xl border border-red-900/60 p-6 text-sm text-red-400">
        {detailsQuery.error?.message ??
          "Pipeline could not be loaded."}
      </div>
    );
  }

  const {
    workflow,
    config,
    yaml,
  } = detailsQuery.data;

  const active =
    workflow.state === "active";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">
                {workflow.name}
              </h2>

              {workflow.managedByHomemade && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs">
                  Homemade
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-zinc-500">
              {workflow.path}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {active ? (
              <button
                type="button"
                onClick={() =>
                  disableMutation.mutate()
                }
                disabled={
                  disableMutation.isPending
                }
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm"
              >
                <PowerOff size={15} />
                Disable
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  enableMutation.mutate()
                }
                disabled={
                  enableMutation.isPending
                }
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm"
              >
                <Power size={15} />
                Enable
              </button>
            )}

            <a
              href={workflow.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm"
            >
              GitHub
              <ExternalLink
                size={15}
              />
            </a>

            {workflow.managedByHomemade && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this Homemade CI/CD pipeline?",
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={
                  deleteMutation.isPending
                }
                className="inline-flex items-center gap-2 rounded-lg border border-red-900/70 px-3 py-2 text-sm text-red-300"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
          </div>
        </div>
      </section>

      {workflow.managedByHomemade &&
        config && (
          <PipelineBuilder
            owner={owner}
            repo={repo}
            defaultBranch={
              defaultBranch
            }
            initialConfig={
              config
            }
            mode="edit"
            onApplied={
              refresh
            }
          />
        )}

      {yaml && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="font-semibold">
            Workflow YAML
          </h3>

          <pre className="mt-4 max-h-[500px] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-400">
            {yaml}
          </pre>
        </section>
      )}
    </div>
  );
}
