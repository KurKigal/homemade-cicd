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

import {
  NodePipelineBuilder,
} from "./NodePipelineBuilder";

import {
  PythonPipelineBuilder,
} from "./PythonPipelineBuilder";

import type {
  ProjectAnalysis,
} from "@homemade-cicd/core";

interface PipelineDetailsPanelProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  workflowId: number;
  projectAnalysis?: ProjectAnalysis;
  projectAnalysisLoading?: boolean;
  projectAnalysisError?: string;
}

export function PipelineDetailsPanel({
  owner,
  repo,
  defaultBranch,
  workflowId,
  projectAnalysis,
  projectAnalysisLoading,
  projectAnalysisError,
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
        config?.projectType === "flutter" && (
          <PipelineBuilder
            owner={owner}
            repo={repo}
            defaultBranch={
              defaultBranch
            }
            initialConfig={
              config.config
            }
            mode="edit"
            onApplied={
              refresh
            }
          />
        )}

      {workflow.managedByHomemade &&
        config?.projectType === "node" && (
          <NodePipelineBuilder
            owner={owner}
            repo={repo}
            defaultBranch={defaultBranch}
            packageManager={
              projectAnalysis?.projectType === "node"
                ? projectAnalysis.packageManager
                : config.config.packageManager
            }
            availableScripts={
              projectAnalysis?.projectType === "node"
                ? projectAnalysis.availableScripts
                : []
            }
            lockfilePresent={
              projectAnalysis?.projectType === "node"
                ? projectAnalysis.lockfilePresent
                : false
            }
            initialConfig={config.config}
            mode="edit"
            onApplied={refresh}
            metadataWarning={
              projectAnalysis?.projectType === "node"
                ? undefined
                : projectAnalysisLoading
                  ? "Repository metadata is still loading. Existing settings are preserved while unavailable additions remain disabled."
                  : projectAnalysisError
                    ? `Repository metadata could not be loaded: ${projectAnalysisError} Existing settings remain editable, but unavailable additions are disabled.`
                    : "This repository is no longer detected as a Node.js project. Existing settings remain editable, but unavailable additions are disabled."
            }
          />
        )}

      {workflow.managedByHomemade &&
        config?.projectType === "python" && (
          <PythonPipelineBuilder
            owner={owner}
            repo={repo}
            defaultBranch={defaultBranch}
            packageManager={
              projectAnalysis?.projectType === "python" &&
              projectAnalysis.python
                ? projectAnalysis.python.packageManager
                : config.config.packageManager
            }
            dependencySource={
              projectAnalysis?.projectType === "python" &&
              projectAnalysis.python
                ? projectAnalysis.python.dependencySource
                : config.config.dependencySource
            }
            availableTasks={
              projectAnalysis?.projectType === "python" &&
              projectAnalysis.python
                ? projectAnalysis.python.availableTasks
                : {
                    ruff: false,
                    pytest: false,
                    mypy: false,
                    build: false,
                  }
            }
            lockfilePresent={
              projectAnalysis?.projectType === "python" &&
              projectAnalysis.python
                ? projectAnalysis.python.lockfilePresent
                : false
            }
            initialConfig={config.config}
            mode="edit"
            onApplied={refresh}
            metadataWarning={
              projectAnalysis?.projectType === "python" &&
              projectAnalysis.python
                ? undefined
                : projectAnalysisLoading
                  ? "Repository metadata is still loading. Existing settings are preserved while unavailable additions remain disabled."
                  : projectAnalysisError
                    ? `Repository metadata could not be loaded: ${projectAnalysisError} Existing settings remain editable, but unavailable additions are disabled.`
                    : "This repository is no longer detected as a Python project. Existing settings remain editable, but unavailable additions are disabled."
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
