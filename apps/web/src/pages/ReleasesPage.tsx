import {
  useQuery,
} from "@tanstack/react-query";

import {
  useNavigate,
  useParams,
} from "react-router";

import {
  ReleaseBuilder,
} from "../features/releases/ReleaseBuilder";

import {
  ReleaseList,
} from "../features/releases/ReleaseList";

import {
  useGitHubUser,
  useRepositories,
} from "../features/repositories/hooks";

import {
  RepositorySelect,
} from "../features/repositories/RepositorySelect";

import {
  AppLayout,
} from "../layouts/AppLayout";

import {
  api,
} from "../lib/api";

import {
  queryKeys,
} from "../lib/query-keys";

export function ReleasesPage() {
  const navigate = useNavigate();

  const {
    owner,
    repo,
  } = useParams<{
    owner: string;
    repo: string;
  }>();

  const userQuery = useGitHubUser();
  const repositoriesQuery = useRepositories();

  const selectedRepository = repositoriesQuery.data?.find(
    (repository) =>
      repository.owner.login === owner && repository.name === repo,
  );

  const releasesQuery = useQuery({
    queryKey: queryKeys.releases(owner, repo),
    queryFn: () => {
      if (!owner || !repo) {
        throw new Error("Repository not selected.");
      }

      return api.github.releases(owner, repo);
    },
    enabled: Boolean(owner && repo),
  });

  function selectRepository(fullName: string) {
    if (!fullName) {
      navigate("/releases");
      return;
    }

    const repository = repositoriesQuery.data?.find(
      (item) => item.fullName === fullName,
    );

    if (!repository) {
      return;
    }

    navigate(
      `/releases/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}`,
    );
  }

  function refresh() {
    void userQuery.refetch();
    void repositoriesQuery.refetch();

    if (owner && repo) {
      void releasesQuery.refetch();
    }
  }

  return (
    <AppLayout
      title="Releases"
      user={userQuery.data}
      isRefreshing={
        userQuery.isFetching ||
        repositoriesQuery.isFetching ||
        releasesQuery.isFetching
      }
      onRefresh={refresh}
    >
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <section className="mb-8">
          <p className="mb-1 text-sm text-zinc-500">
            GitHub Releases
          </p>

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Release builder
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Turn a successful workflow run and its artifacts into a
                traceable GitHub release.
              </p>
            </div>

            <RepositorySelect
              owner={owner}
              repo={repo}
              repositories={repositoriesQuery.data ?? []}
              onChange={selectRepository}
            />
          </div>
        </section>

        {!owner || !repo ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            Select a repository to view and create releases.
          </div>
        ) : repositoriesQuery.isLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-500">
            Loading release workspace...
          </div>
        ) : repositoriesQuery.isError ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
            {repositoriesQuery.error.message}
          </div>
        ) : !selectedRepository ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-400">
            The selected repository is not available to this GitHub account.
          </div>
        ) : (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(460px,1.15fr)]">
            <ReleaseList
              releases={releasesQuery.data ?? []}
              isLoading={releasesQuery.isLoading}
              errorMessage={
                releasesQuery.isError
                  ? releasesQuery.error.message
                  : undefined
              }
            />

            <ReleaseBuilder
              key={selectedRepository.fullName}
              owner={owner}
              repo={repo}
              defaultBranch={selectedRepository.defaultBranch}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
