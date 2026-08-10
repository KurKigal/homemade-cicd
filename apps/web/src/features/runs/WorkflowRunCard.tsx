import type {
  WorkflowRun,
} from "@homemade-cicd/core";

import {
  GitBranch,
  GitCommitHorizontal,
} from "lucide-react";

import {
  Link,
} from "react-router";

import {
  RunStatusBadge,
} from "./RunStatusBadge";

interface WorkflowRunCardProps {
  owner: string;
  repo: string;

  run: WorkflowRun;
}

export function WorkflowRunCard({
  owner,
  repo,
  run,
}: WorkflowRunCardProps) {
  return (
    <Link
      to={`/runs/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${run.id}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <RunStatusBadge
              status={run.status}
              conclusion={
                run.conclusion
              }
            />

            <span className="text-xs text-zinc-600">
              #{run.runNumber}
            </span>

            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {run.event}
            </span>
          </div>

          <h3 className="mt-3 truncate font-medium">
            {run.displayTitle}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {run.workflowName}
          </p>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} />

              {run.headBranch ??
                "unknown"}
            </span>

            <span className="flex items-center gap-1.5">
              <GitCommitHorizontal
                size={13}
              />

              {run.headSha.slice(
                0,
                7,
              )}
            </span>

            <span>
              {formatDate(
                run.createdAt,
              )}
            </span>
          </div>
        </div>

        {run.actor && (
          <img
            src={run.actor.avatarUrl}
            alt=""
            title={run.actor.login}
            className="h-8 w-8 rounded-full"
          />
        )}
      </div>
    </Link>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(date));
}