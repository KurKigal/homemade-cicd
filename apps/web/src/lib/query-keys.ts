export const queryKeys = {
  githubUser: ["github", "me"] as const,
  repositories: ["github", "repositories"] as const,
  inspection: (owner?: string, repo?: string) =>
    ["github", "inspection", owner, repo] as const,
  runs: (owner?: string, repo?: string) =>
    ["github", "runs", owner, repo] as const,
  run: (owner: string | undefined, repo: string | undefined, runId: number) =>
    ["github", "run", owner, repo, runId] as const,
  runJobs: (owner: string | undefined, repo: string | undefined, runId: number) =>
    ["github", "run-jobs", owner, repo, runId] as const,
  runArtifacts: (
    owner: string | undefined,
    repo: string | undefined,
    runId: number,
  ) => ["github", "run-artifacts", owner, repo, runId] as const,
  pipelines: (owner?: string, repo?: string) =>
    ["github", "pipelines", owner, repo] as const,
  pipeline: (owner: string, repo: string, workflowId: number) =>
    ["github", "pipeline", owner, repo, workflowId] as const,
};
