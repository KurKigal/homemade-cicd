import { useQuery } from "@tanstack/react-query";

import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export function useSigningStatus(owner: string, repo: string) {
  return useQuery({
    queryKey: queryKeys.signing(owner, repo),
    queryFn: () => api.github.signingStatus(owner, repo),
  });
}
