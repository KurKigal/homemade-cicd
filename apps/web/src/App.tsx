import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  GitBranch,
  GitFork,
  Lock,
  RefreshCw,
  Search,
  Server,
  Unlock,
} from "lucide-react";

import { PipelineBuilder } from "./components/PipelineBuilder";
import { api } from "./lib/api";

function formatUpdatedAt(date: string | null) {
  if (!date) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function App() {
  const [search, setSearch] = useState("");

  const [selectedRepository, setSelectedRepository] = useState<{
    owner: string;
    name: string;
    defaultBranch: string;
  } | null>(null);

  const userQuery = useQuery({
    queryKey: ["github", "me"],
    queryFn: api.github.me,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["github", "repositories"],
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
        throw new Error("No repository selected.");
      }

      return api.github.inspectRepository(
        selectedRepository.owner,
        selectedRepository.name,
      );
    },

    enabled: selectedRepository !== null,
  });

  const repositories = useMemo(() => {
    const repos = repositoriesQuery.data ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return repos;
    }

    return repos.filter((repo) => {
      return (
        repo.name.toLowerCase().includes(normalizedSearch) ||
        repo.description?.toLowerCase().includes(normalizedSearch) ||
        repo.language?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [repositoriesQuery.data, search]);

  const refresh = () => {
    void userQuery.refetch();
    void repositoriesQuery.refetch();

    if (selectedRepository) {
      void inspectionQuery.refetch();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-zinc-950 lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-950">
            <Activity size={20} />
          </div>

          <div>
            <div className="font-semibold tracking-tight">
              Homemade CI/CD
            </div>

            <div className="text-xs text-zinc-500">
              Personal DevOps
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          <button className="flex w-full items-center gap-3 rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium">
            <Server size={18} />
            Projects
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            <Activity size={18} />
            Runs
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            <GitBranch size={18} />
            Pipelines
          </button>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-zinc-800 p-4">
          {userQuery.data ? (
            <div className="flex items-center gap-3">
              <img
                src={userQuery.data.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full"
              />

              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {userQuery.data.name ?? userQuery.data.login}
                </div>

                <div className="truncate text-xs text-zinc-500">
                  @{userQuery.data.login}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              GitHub connection...
            </div>
          )}
        </div>
      </aside>

      <main className="lg:ml-64">
        <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-6 lg:px-8">
          <h1 className="font-semibold">
            Projects
          </h1>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-zinc-500 sm:flex">
              <GitFork size={17} />

              {userQuery.data
                ? `Connected as ${userQuery.data.login}`
                : "Connecting..."}
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={repositoriesQuery.isFetching}
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-900 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  repositoriesQuery.isFetching
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>
          </div>
        </header>

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
                  Choose a repository to inspect its project structure
                  and configure a CI/CD pipeline.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search repositories..."
                  className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                />
              </div>
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
                GitHub repositories could not be loaded.
              </div>

              <div className="mt-2 text-sm text-red-400">
                {repositoriesQuery.error.message}
              </div>
            </div>
          )}

          {!repositoriesQuery.isLoading &&
            !repositoriesQuery.isError && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-zinc-500">
                    {repositories.length} repositories
                  </span>
                </div>

                {selectedRepository && (
                  <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                          Project analysis
                        </p>

                        <h3 className="mt-1 text-xl font-semibold">
                          {selectedRepository.owner}/
                          {selectedRepository.name}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedRepository(null)
                        }
                        className="text-sm text-zinc-500 hover:text-zinc-200"
                      >
                        Close
                      </button>
                    </div>

                    {inspectionQuery.isLoading && (
                      <div className="text-sm text-zinc-500">
                        Inspecting repository structure...
                      </div>
                    )}

                    {inspectionQuery.isError && (
                      <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-400">
                        {inspectionQuery.error.message}
                      </div>
                    )}

                    {inspectionQuery.data && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-xs text-zinc-500">
                              Framework
                            </p>

                            <p className="mt-2 font-medium">
                              {inspectionQuery.data.analysis.framework ??
                                "Unknown"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-xs text-zinc-500">
                              Language
                            </p>

                            <p className="mt-2 font-medium">
                              {inspectionQuery.data.analysis.language ??
                                "Unknown"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-xs text-zinc-500">
                              Android
                            </p>

                            <p className="mt-2 font-medium">
                              {inspectionQuery.data.analysis.platforms
                                .android
                                ? "Ready"
                                : "Not detected"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-xs text-zinc-500">
                              iOS
                            </p>

                            <p className="mt-2 font-medium">
                              {inspectionQuery.data.analysis.platforms.ios
                                ? "Ready"
                                : "Not detected"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-xs text-zinc-500">
                              Existing CI/CD
                            </p>

                            <p className="mt-2 font-medium">
                              {inspectionQuery.data.analysis.ciConfigured
                                ? "Detected"
                                : "Not configured"}
                            </p>
                          </div>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:col-span-2 lg:col-span-3">
                            <p className="text-xs text-zinc-500">
                              Detection signals
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {inspectionQuery.data.analysis.signals
                                .length > 0 ? (
                                inspectionQuery.data.analysis.signals.map(
                                  (signal) => (
                                    <span
                                      key={signal}
                                      className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                                    >
                                      {signal}
                                    </span>
                                  ),
                                )
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  No known project markers detected.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {inspectionQuery.data.analysis.projectType ===
                          "flutter" && (
                          <PipelineBuilder
                            owner={selectedRepository.owner}
                            repo={selectedRepository.name}
                            defaultBranch={
                              selectedRepository.defaultBranch
                            }
                          />
                        )}

                        {inspectionQuery.data.analysis.projectType !==
                          "flutter" && (
                          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                            <p className="text-sm text-zinc-500">
                              Pipeline Builder is currently available
                              for Flutter projects. Support for this
                              project type will be added later.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}

                {repositories.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
                    No repositories match your search.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {repositories.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() =>
                          setSelectedRepository({
                            owner: repo.owner.login,
                            name: repo.name,
                            defaultBranch: repo.defaultBranch,
                          })
                        }
                        className="group flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-medium text-zinc-100">
                              {repo.name}
                            </h3>

                            <span className="flex items-center gap-1 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
                              {repo.private ? (
                                <Lock size={11} />
                              ) : (
                                <Unlock size={11} />
                              )}

                              {repo.private
                                ? "Private"
                                : "Public"}
                            </span>

                            {repo.language && (
                              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                                {repo.language}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 max-w-3xl truncate text-sm text-zinc-500">
                            {repo.description ??
                              "No repository description"}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
                            <span className="flex items-center gap-1.5">
                              <GitBranch size={13} />
                              {repo.defaultBranch}
                            </span>

                            <span>
                              Updated{" "}
                              {formatUpdatedAt(repo.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <ChevronRight
                          size={20}
                          className="ml-5 shrink-0 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
      </main>
    </div>
  );
}

export default App;