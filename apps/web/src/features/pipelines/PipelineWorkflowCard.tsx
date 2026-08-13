import type {
  RepositoryWorkflow,
} from "@homemade-cicd/core";

import {
  ExternalLink,
  GitBranch,
} from "lucide-react";

interface PipelineWorkflowCardProps {
  workflow:
    RepositoryWorkflow;

  selected: boolean;

  onSelect: () => void;
}

export function PipelineWorkflowCard({
  workflow,
  selected,
  onSelect,
}: PipelineWorkflowCardProps) {
  const active =
    workflow.state === "active";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-xl border p-5 text-left transition",

        selected
          ? "border-zinc-600 bg-zinc-900"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch
              size={16}
            />

            <h3 className="font-medium">
              {workflow.name}
            </h3>

            {workflow.managedByHomemade && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                Homemade
              </span>
            )}

            <span
              className={
                active
                  ? "text-xs text-emerald-400"
                  : "text-xs text-amber-400"
              }
            >
              {active
                ? "Active"
                : "Disabled"}
            </span>
          </div>

          <p className="mt-2 truncate text-xs text-zinc-500">
            {workflow.path}
          </p>
        </div>

        <ExternalLink
          size={15}
          className="text-zinc-600"
        />
      </div>
    </button>
  );
}
