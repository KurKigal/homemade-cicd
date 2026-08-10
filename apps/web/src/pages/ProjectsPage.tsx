import {
  useMemo,
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import { api } from "../lib/api";

import {
  AppLayout,
} from "../layouts/AppLayout";

import {
  ProjectAnalysisPanel,
} from "../features/project-analysis/ProjectAnalysisPanel";

import {
  RepositoryList,
} from "../features/repositories/RepositoryList";

import {
  RepositorySearch,
} from "../features/repositories/RepositorySearch";

import type {
  SelectedRepository,
} from "../features/repositories/types";

export function ProjectsPage() {
  const [search, setSearch] = useState("");

  const [
    selectedRepository,
    setSelectedRepository,
  ] = useState<SelectedRepository | null>(
    null,
  );

  const userQuery = useQuery({
    queryKey: ["github", "me"],
    queryFn: api.github.me,
  });

  const repositoriesQuery = useQuery({
    queryKey: [
      "github",
      "repositories",
    ],
    queryFn: api.github.repositories,
  });

  const inspectionQuery = useQuery({
    queryKey: [
      "github",
      "inspection",
      selectedRepository?.owner,
      selectedRepository?.name,
    ],

    queryFn: () => {
      if (!selectedRepository) {
        throw new Error(
          "No repository selected.",
        );
      }

      return api.github.inspectRepository(
        selectedRepository.owner,
        selectedRepository.name,
      );
    },

    enabled: selectedRepository !== null,
  });

  const repositories = useMemo(() => {
    const repos =
      repositoriesQuery.data ?? [];

    const normalizedSearch = search
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return repos;
    }

    return repos.filter((repository) => {
      return (
        repository.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        repository.description
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        repository.language
          ?.toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [
    repositoriesQuery.data,
    search,
  ]);

  function refresh() {
    void userQuery.refetch();
    void repositoriesQuery.refetch();

    if (selectedRepository) {
      void inspectionQuery.refetch();
    }
  }

  return (
    <AppLayout
      user={userQuery.data}
      isRefreshing={
        repositoriesQuery.isFetching
      }
      onRefresh={refresh}
    >
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <section className="mb-8">
          <p className="mb-1 text-sm text-zinc-500">
            GitHub repositories
          </p>

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Select a project
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Choose a repository to inspect
                its project structure and
                configure a CI/CD pipeline.
              </p>
            </div>

            <RepositorySearch
              value={search}
              onChange={setSearch}
            />
          </div>
        </section>

        {repositoriesQuery.isLoading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
            Loading repositories...
          </div>
        )}

        {repositoriesQuery.isError && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5">
            <div className="font-medium text-red-300">
              GitHub repositories could not
              be loaded.
            </div>

            <div className="mt-2 text-sm text-red-400">
              {
                repositoriesQuery.error
                  .message
              }
            </div>
          </div>
        )}

        {!repositoriesQuery.isLoading &&
          !repositoriesQuery.isError && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  {repositories.length}{" "}
                  repositories
                </span>
              </div>

              {selectedRepository && (
                <ProjectAnalysisPanel
                  repository={
                    selectedRepository
                  }
                  inspection={
                    inspectionQuery.data
                  }
                  isLoading={
                    inspectionQuery.isLoading
                  }
                  errorMessage={
                    inspectionQuery.isError
                      ? inspectionQuery.error
                          .message
                      : undefined
                  }
                  onClose={() =>
                    setSelectedRepository(null)
                  }
                />
              )}

              <RepositoryList
                repositories={repositories}
                onSelect={
                  setSelectedRepository
                }
              />
            </>
          )}
      </div>
    </AppLayout>
  );
}