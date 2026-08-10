import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

export function listRepositoryRuns(
  owner: string,
  repo: string,
  perPage = 30,
) {
  return githubAdapter.listWorkflowRuns(
    owner,
    repo,
    perPage,
  );
}

export function getRepositoryRun(
  owner: string,
  repo: string,
  runId: number,
) {
  return githubAdapter.getWorkflowRun(
    owner,
    repo,
    runId,
  );
}

export function listRepositoryRunJobs(
  owner: string,
  repo: string,
  runId: number,
) {
  return githubAdapter.listWorkflowRunJobs(
    owner,
    repo,
    runId,
  );
}