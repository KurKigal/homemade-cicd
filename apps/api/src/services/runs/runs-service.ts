import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

import type {
  WorkflowCommandResult,
} from "@homemade-cicd/core";

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

const HOMEMADE_WORKFLOW =
  "homemade-ci.yml";

export async function dispatchRepositoryWorkflow(
  owner: string,
  repo: string,
  ref: string,
): Promise<WorkflowCommandResult> {
  await githubAdapter.dispatchWorkflow(
    owner,
    repo,
    HOMEMADE_WORKFLOW,
    ref,
  );

  return {
    success: true,
    message: "Workflow dispatched.",
  };
}

export async function rerunRepositoryWorkflow(
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowCommandResult> {
  await githubAdapter.rerunWorkflow(
    owner,
    repo,
    runId,
  );

  return {
    success: true,
    message: "Workflow re-run started.",
  };
}

export async function rerunFailedRepositoryJobs(
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowCommandResult> {
  await githubAdapter.rerunFailedWorkflowJobs(
    owner,
    repo,
    runId,
  );

  return {
    success: true,
    message: "Failed jobs re-run started.",
  };
}

export async function cancelRepositoryWorkflow(
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowCommandResult> {
  await githubAdapter.cancelWorkflowRun(
    owner,
    repo,
    runId,
  );

  return {
    success: true,
    message: "Workflow cancellation requested.",
  };
}