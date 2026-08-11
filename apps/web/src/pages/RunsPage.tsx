import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  AppLayout,
} from "../layouts/AppLayout";

import {
  WorkflowRunCard,
} from "../features/runs/WorkflowRunCard";

import {
  api,
} from "../lib/api";

import {
  Play,
} from "lucide-react";

export function RunsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    owner,
    repo,
  } = useParams<{
    owner: string;
    repo: string;
  }>();

  const userQuery = useQuery({
    queryKey: ["github", "me"],
    queryFn: api.github.me,
  });

  const repositoriesQuery =
    useQuery({
      queryKey: [
        "github",
        "repositories",
      ],
      queryFn:
        api.github.repositories,
    });

  const selectedRepository =
    repositoriesQuery.data?.find(
      (repository) =>
        repository.owner.login === owner &&
        repository.name === repo,
    );

  const runsQuery = useQuery({
    queryKey: [
      "github",
      "runs",
      owner,
      repo,
    ],

    queryFn: () => {
      if (!owner || !repo) {
        throw new Error(
          "Repository not selected.",
        );
      }

      return api.github.workflowRuns(
        owner,
        repo,
      );
    },

    enabled:
      Boolean(owner && repo),

    refetchInterval: 10_000,
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!owner || !repo || !selectedRepository) {
        throw new Error(
          "Repository not selected.",
        );
      }

      return api.github.dispatchWorkflow(
        owner,
        repo,
        selectedRepository.defaultBranch
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "github",
          "runs",
          owner,
          repo,
        ],
      });
    },
  });

  function refresh() {
    void userQuery.refetch();
    void repositoriesQuery.refetch();

    if (owner && repo) {
      void runsQuery.refetch();
    }
  }

  function selectRepository(
    value: string,
  ) {
    if (!value) {
      navigate("/runs");
      return;
    }

    const repository =
      repositoriesQuery.data?.find(
        (item) =>
          item.fullName === value,
      );

    if (!repository) {
      return;
    }

    navigate(
      `/runs/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`,
    );
  }

  return (
    <AppLayout
      title="Runs"
      user={userQuery.data}
      isRefreshing={
        runsQuery.isFetching
      }
      onRefresh={refresh}
    >
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <section className="mb-8">
          <p className="mb-1 text-sm text-zinc-500">
            GitHub Actions
          </p>

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Workflow runs
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Inspect recent CI/CD
                executions and their
                current state.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={
                  owner && repo
                    ? `${owner}/${repo}`
                    : ""
                }
                onChange={(event) =>
                  selectRepository(
                    event.target.value,
                  )
                }
                className="h-10 min-w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
              >
                <option value="">
                  Select repository
                </option>

                {repositoriesQuery.data?.map(
                  (repository) => (
                    <option
                      key={
                        repository.id
                      }
                      value={
                        repository.fullName
                      }
                    >
                      {
                        repository.fullName
                      }
                    </option>
                  ),
                )}
              </select>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    value={
                      owner && repo
                        ? `${owner}/${repo}`
                        : ""
                    }
                    onChange={(event) =>
                      selectRepository(event.target.value)
                    }
                    className="h-10 min-w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-600"
                  >
                    <option value="">
                      Select repository
                    </option>

                    {repositoriesQuery.data?.map(
                      (repository) => (
                        <option
                          key={repository.id}
                          value={repository.fullName}
                        >
                          {repository.fullName}
                        </option>
                      ),
                    )}
                  </select>

                  {owner &&
                    repo &&
                    selectedRepository && (
                      <button
                        type="button"
                        onClick={() =>
                          dispatchMutation.mutate()
                        }
                        disabled={
                          dispatchMutation.isPending
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play size={15} />

                        {dispatchMutation.isPending
                          ? "Starting..."
                          : "Run Now"}
                      </button>
                    )}
                </div>

                {dispatchMutation.isError && (
                  <p className="text-sm text-red-400">
                    {dispatchMutation.error.message}
                  </p>
                )}

                {dispatchMutation.isSuccess && (
                  <p className="text-sm text-emerald-400">
                    {dispatchMutation.data.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {!owner || !repo ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            Select a repository to
            view its workflow runs.
          </div>
        ) : runsQuery.isLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            Loading workflow runs...
          </div>
        ) : runsQuery.isError ? (
          <div className="rounded-xl border border-red-900 bg-red-950/20 p-5 text-red-300">
            {
              runsQuery.error
                .message
            }
          </div>
        ) : runsQuery.data &&
          runsQuery.data.runs
            .length > 0 ? (
          <>
            <div className="mb-4 text-sm text-zinc-500">
              {
                runsQuery.data
                  .totalCount
              }{" "}
              workflow runs
            </div>

            <div className="grid gap-3">
              {runsQuery.data.runs.map(
                (run) => (
                  <WorkflowRunCard
                    key={run.id}
                    owner={owner}
                    repo={repo}
                    run={run}
                  />
                ),
              )}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            No GitHub Actions runs
            found for this repository.
          </div>
        )}
      </div>
    </AppLayout>
  );
}