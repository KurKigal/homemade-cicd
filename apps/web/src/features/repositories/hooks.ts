import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export function useGitHubUser() {
  return useQuery({
    queryKey: queryKeys.githubUser,
    queryFn: api.github.me,
  });
}

export function useRepositories() {
  return useQuery({
    queryKey: queryKeys.repositories,
    queryFn: api.github.repositories,
  });
}

export function useRepositoryInspection(
  owner?: string,
  repo?: string,
) {
  return useQuery({
    queryKey: queryKeys.inspection(owner, repo),
    queryFn: () => {
      if (!owner || !repo) {
        throw new Error("Repository not selected.");
      }

      return api.github.inspectRepository(owner, repo);
    },
    enabled: Boolean(owner && repo),
  });
}
