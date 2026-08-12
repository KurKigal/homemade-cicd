import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

export function listRunArtifacts(
  owner: string,
  repo: string,
  runId: number,
) {
  return githubAdapter.listWorkflowRunArtifacts(
    owner,
    repo,
    runId,
  );
}

export function getArtifactDownloadUrl(
  owner: string,
  repo: string,
  artifactId: number,
) {
  return githubAdapter.getArtifactDownloadUrl(
    owner,
    repo,
    artifactId,
  );
}