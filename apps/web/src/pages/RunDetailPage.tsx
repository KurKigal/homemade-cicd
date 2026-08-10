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
  AppLayout,
} from "../layouts/AppLayout";

import {
  RunStatusBadge,
} from "../features/runs/RunStatusBadge";

import {
  api,
} from "../lib/api";

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

  const userQuery = useQuery({
    queryKey: ["github", "me"],
    queryFn: api.github.me,
  });

  const runQuery = useQuery({
    queryKey: [
      "github",
      "run",
      owner,
      repo,
      parsedRunId,
    ],

    queryFn: () =>
      api.github.workflowRun(
        owner!,
        repo!,
        parsedRunId,
      ),

    enabled: valid,

    refetchInterval: 10_000,
  });

  const jobsQuery = useQuery({
    queryKey: [
      "github",
      "run-jobs",
      owner,
      repo,
      parsedRunId,
    ],

    queryFn: () =>
      api.github.workflowRunJobs(
        owner!,
        repo!,
        parsedRunId,
      ),

    enabled: valid,

    refetchInterval: 10_000,
  });

  function refresh() {
    void userQuery.refetch();
    void runQuery.refetch();
    void jobsQuery.refetch();
  }

  return (
    <AppLayout
      title="Run Details"
      user={userQuery.data}
      isRefreshing={
        runQuery.isFetching ||
        jobsQuery.isFetching
      }
      onRefresh={refresh}
    >
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        {owner && repo && (
          <Link
            to={`/runs/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
            className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200"
          >
            <ArrowLeft size={16} />
            Back to runs
          </Link>
        )}

        {!valid ? (
          <div className="text-red-400">
            Invalid workflow run.
          </div>
        ) : runQuery.isLoading ? (
          <div className="text-zinc-500">
            Loading run...
          </div>
        ) : runQuery.isError ? (
          <div className="text-red-400">
            {
              runQuery.error
                .message
            }
          </div>
        ) : runQuery.data ? (
          <>
            <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div>
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

                  <h2 className="mt-3 text-2xl font-semibold">
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
                      {
                        runQuery.data.run
                          .headBranch
                      }
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

                <a
                  href={
                    runQuery.data.run
                      .htmlUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900"
                >
                  Open on GitHub
                  <ExternalLink
                    size={15}
                  />
                </a>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-lg font-semibold">
                Jobs
              </h3>

              {jobsQuery.isLoading ? (
                <div className="text-sm text-zinc-500">
                  Loading jobs...
                </div>
              ) : jobsQuery.isError ? (
                <div className="text-sm text-red-400">
                  {
                    jobsQuery.error
                      .message
                  }
                </div>
              ) : (
                <div className="space-y-4">
                  {jobsQuery.data?.jobs.map(
                    (job) => (
                      <div
                        key={job.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="font-medium">
                              {
                                job.name
                              }
                            </h4>

                            {job.runnerName && (
                              <p className="mt-1 text-xs text-zinc-600">
                                Runner:{" "}
                                {
                                  job.runnerName
                                }
                              </p>
                            )}
                          </div>

                          <RunStatusBadge
                            status={
                              job.status
                            }
                            conclusion={
                              job.conclusion
                            }
                          />
                        </div>

                        <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
                          {job.steps.map(
                            (step) => (
                              <div
                                key={
                                  step.number
                                }
                                className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 text-sm"
                              >
                                <span className="text-zinc-400">
                                  {
                                    step.number
                                  }
                                  .{" "}
                                  {
                                    step.name
                                  }
                                </span>

                                <RunStatusBadge
                                  status={
                                    step.status
                                  }
                                  conclusion={
                                    step.conclusion
                                  }
                                />
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}