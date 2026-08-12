import type {
  PipelineCommandResult,
  PipelineDetailsResponse,
} from "@homemade-cicd/core";

import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

import {
  parseFlutterWorkflow,
} from "./workflow-parser.js";

const HOMEMADE_PATH =
  ".github/workflows/homemade-ci.yml";

export function listRepositoryPipelines(
  owner: string,
  repo: string,
) {
  return githubAdapter.listRepositoryWorkflows(
    owner,
    repo,
  );
}

export async function getPipelineDetails(
  owner: string,
  repo: string,
  workflowId: number,
): Promise<PipelineDetailsResponse> {
  const workflow =
    await githubAdapter.getRepositoryWorkflow(
      owner,
      repo,
      workflowId,
    );

  const defaultBranch =
    await githubAdapter.getRepositoryDefaultBranch(
      owner,
      repo,
    );

  const yaml =
    await githubAdapter.readTextFile(
      owner,
      repo,
      workflow.path,
      defaultBranch,
    );

  if (
    !workflow.managedByHomemade ||
    !yaml
  ) {
    return {
      workflow,
      yaml,
      config: null,
    };
  }

  const config =
    parseFlutterWorkflow(
      yaml,
      defaultBranch,
    );

  return {
    workflow,
    yaml,
    config,
  };
}

export async function enablePipeline(
  owner: string,
  repo: string,
  workflowId: number,
): Promise<PipelineCommandResult> {
  await githubAdapter.enableWorkflow(
    owner,
    repo,
    workflowId,
  );

  return {
    success: true,
    message:
      "Pipeline enabled.",
  };
}

export async function disablePipeline(
  owner: string,
  repo: string,
  workflowId: number,
): Promise<PipelineCommandResult> {
  await githubAdapter.disableWorkflow(
    owner,
    repo,
    workflowId,
  );

  return {
    success: true,
    message:
      "Pipeline disabled.",
  };
}

export async function deleteManagedPipeline(
  owner: string,
  repo: string,
  workflowId: number,
): Promise<PipelineCommandResult> {
  const workflow =
    await githubAdapter.getRepositoryWorkflow(
      owner,
      repo,
      workflowId,
    );

  if (
    workflow.path !==
    HOMEMADE_PATH
  ) {
    throw new Error(
      "Only Homemade CI/CD managed pipelines can be deleted here.",
    );
  }

  const defaultBranch =
    await githubAdapter.getRepositoryDefaultBranch(
      owner,
      repo,
    );

  const sha =
    await githubAdapter.getFileSha(
      owner,
      repo,
      workflow.path,
      defaultBranch,
    );

  if (!sha) {
    throw new Error(
      "Pipeline workflow file was not found.",
    );
  }

  await githubAdapter.deleteTextFile({
    owner,
    repo,

    path:
      workflow.path,

    branch:
      defaultBranch,

    sha,

    message:
      "ci: remove Homemade CI/CD pipeline",
  });

  return {
    success: true,
    message:
      "Pipeline deleted.",
  };
}