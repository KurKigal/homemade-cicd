import {
  useQuery,
} from "@tanstack/react-query";

import {
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

import {
  Link,
  useParams,
} from "react-router";

import {
  RunActions,
} from "../features/runs/RunActions";

import {
  RunStatusBadge,
} from "../features/runs/RunStatusBadge";

import {
  AppLayout,
} from "../layouts/AppLayout";

import {
  api,
} from "../lib/api";

import { queryKeys } from "../lib/query-keys";

import { useGitHubUser } from "../features/repositories/hooks";

import {
  ArtifactsSection,
} from "../features/runs/ArtifactsSection";

import { JobsSection } from "../features/runs/JobsSection";

export function RunDetailPage() {
  const {
    owner,
    repo,
    runId,
  } = useParams<{
    owner: string;
    repo: string;
    runId: string;
  }>();

  const parsedRunId =
    Number(runId);

  const valid =
    Boolean(owner && repo) &&
    Number.isSafeInteger(
      parsedRunId,
    ) &&
    parsedRunId > 0;

  const userQuery = useGitHubUser();

  const runQuery = useQuery({
    queryKey: queryKeys.run(owner, repo, parsedRunId),

    queryFn: () => {
      if (!owner || !repo) {
        throw new Error(
          "Invalid repository.",
        );
      }

      return api.github.workflowRun(
        owner,
        repo,
        parsedRunId,
      );
    },

    enabled: valid,

    refetchInterval: 10_000,
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.runJobs(owner, repo, parsedRunId),

    queryFn: () => {
      if (!owner || !repo) {
        throw new Error(
          "Invalid repository.",
        );
      }

      return api.github.workflowRunJobs(
        owner,
        repo,
        parsedRunId,
      );
    },

    enabled: valid,

    refetchInterval: 10_000,
  });

  const artifactsQuery = useQuery({
    queryKey: queryKeys.runArtifacts(owner, repo, parsedRunId),

    queryFn: () => {
      if (!owner || !repo) {
        throw new Error(
          "Invalid repository.",
        );
      }

      return api.github.workflowRunArtifacts(
        owner,
        repo,
        parsedRunId,
      );
    },

    enabled: valid,

    refetchInterval: 10_000,
  });

  function refresh() {
    void userQuery.refetch();

    if (valid) {
      void runQuery.refetch();
      void jobsQuery.refetch();
      void artifactsQuery.refetch();
    }
  }

  return (
    <AppLayout
      title="Run Details"
      user={userQuery.data}
      isRefreshing={
        runQuery.isFetching ||
        jobsQuery.isFetching ||
        artifactsQuery.isFetching
      }
      onRefresh={refresh}
    >
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        {owner && repo && (
          <Link
            to={`/runs/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
            className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"
          >
            <ArrowLeft size={16} />
            Back to runs
          </Link>
        )}

        {!valid ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
            Invalid workflow run.
          </div>
        ) : runQuery.isLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
            Loading run...
          </div>
        ) : runQuery.isError ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
            {runQuery.error.message}
          </div>
        ) : runQuery.data &&
          owner &&
          repo ? (
          <>
            <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div className="min-w-0">
                  <RunStatusBadge
                    status={
                      runQuery.data.run
                        .status
                    }
                    conclusion={
                      runQuery.data.run
                        .conclusion
                    }
                  />

                  <h2 className="mt-3 break-words text-2xl font-semibold">
                    {
                      runQuery.data.run
                        .displayTitle
                    }
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {
                      runQuery.data.run
                        .workflowName
                    }{" "}
                    #
                    {
                      runQuery.data.run
                        .runNumber
                    }
                  </p>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-500">
                    <span>
                      Branch:{" "}
                      {runQuery.data.run
                        .headBranch ??
                        "unknown"}
                    </span>

                    <span>
                      Commit:{" "}
                      {runQuery.data.run.headSha.slice(
                        0,
                        7,
                      )}
                    </span>

                    <span>
                      Event:{" "}
                      {
                        runQuery.data.run
                          .event
                      }
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
                  <RunActions
                    owner={owner}
                    repo={repo}
                    run={
                      runQuery.data.run
                    }
                  />

                  <a
                    href={
                      runQuery.data.run
                        .htmlUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-900"
                  >
                    Open on GitHub
                    <ExternalLink
                      size={15}
                    />
                  </a>
                </div>
              </div>
            </section>

            <JobsSection
              jobs={jobsQuery.data?.jobs ?? []}
              isLoading={jobsQuery.isLoading}
              errorMessage={
                jobsQuery.isError
                  ? jobsQuery.error.message
                  : undefined
              }
            />
            <ArtifactsSection
                owner={owner}
                repo={repo}
                artifacts={
                  artifactsQuery.data?.artifacts ?? []
                }
                isLoading={
                  artifactsQuery.isLoading
                }
                errorMessage={
                  artifactsQuery.isError
                    ? artifactsQuery.error.message
                    : undefined
                }
              />
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
