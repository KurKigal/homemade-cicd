import {
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  PipelineDetailsPanel,
} from "../features/pipelines/PipelineDetailsPanel";

import {
  PipelineWorkflowCard,
} from "../features/pipelines/PipelineWorkflowCard";

import {
  AppLayout,
} from "../layouts/AppLayout";

import {
  api,
} from "../lib/api";

export function PipelinesPage() {
  const navigate =
    useNavigate();

  const {
    owner,
    repo,
  } = useParams<{
    owner: string;
    repo: string;
  }>();

  const [
    selectedWorkflowId,
    setSelectedWorkflowId,
  ] = useState<number | null>(
    null,
  );

  const userQuery =
    useQuery({
      queryKey: [
        "github",
        "me",
      ],

      queryFn:
        api.github.me,
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
        repository.owner.login ===
          owner &&
        repository.name === repo,
    );

  const pipelinesQuery =
    useQuery({
      queryKey: [
        "github",
        "pipelines",
        owner,
        repo,
      ],

      queryFn: () => {
        if (!owner || !repo) {
          throw new Error(
            "Repository not selected.",
          );
        }

        return api.github.pipelines(
          owner,
          repo,
        );
      },

      enabled:
        Boolean(
          owner &&
            repo,
        ),
    });

  function selectRepository(
    fullName: string,
  ) {
    setSelectedWorkflowId(
      null,
    );

    if (!fullName) {
      navigate(
        "/pipelines",
      );

      return;
    }

    const repository =
      repositoriesQuery.data?.find(
        (item) =>
          item.fullName ===
          fullName,
      );

    if (!repository) {
      return;
    }

    navigate(
      `/pipelines/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`,
    );
  }

  function refresh() {
    void userQuery.refetch();
    void repositoriesQuery.refetch();

    if (owner && repo) {
      void pipelinesQuery.refetch();
    }
  }

  return (
    <AppLayout
      title="Pipelines"
      user={userQuery.data}
      isRefreshing={
        pipelinesQuery.isFetching
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
                Pipelines
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Inspect and manage repository workflows.
              </p>
            </div>

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
              className="h-10 min-w-72 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm"
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
          </div>
        </section>

        {!owner || !repo ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            Select a repository to manage its pipelines.
          </div>
        ) : pipelinesQuery.isLoading ? (
          <div className="text-zinc-500">
            Loading pipelines...
          </div>
        ) : pipelinesQuery.isError ? (
          <div className="text-red-400">
            {
              pipelinesQuery.error
                .message
            }
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="space-y-3">
              {pipelinesQuery.data
                ?.workflows.length ? (
                pipelinesQuery.data.workflows.map(
                  (workflow) => (
                    <PipelineWorkflowCard
                      key={
                        workflow.id
                      }
                      workflow={
                        workflow
                      }
                      selected={
                        selectedWorkflowId ===
                        workflow.id
                      }
                      onSelect={() =>
                        setSelectedWorkflowId(
                          workflow.id,
                        )
                      }
                    />
                  ),
                )
              ) : (
                <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-500">
                  No workflows found.
                </div>
              )}
            </div>

            <div>
              {selectedWorkflowId &&
              selectedRepository &&
              owner &&
              repo ? (
                <PipelineDetailsPanel
                  owner={owner}
                  repo={repo}
                  defaultBranch={
                    selectedRepository.defaultBranch
                  }
                  workflowId={
                    selectedWorkflowId
                  }
                />
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
                  Select a pipeline to inspect it.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}