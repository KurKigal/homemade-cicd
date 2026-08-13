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
