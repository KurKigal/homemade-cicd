import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

import {
  HOMEMADE_WORKFLOW_PATH,
} from "@homemade-cicd/core";

export async function saveWorkflow({
  owner,
  repo,
  yaml,
}: {
  owner: string;
  repo: string;
  yaml: string;
}) {
  const defaultBranch =
    await githubAdapter.getRepositoryDefaultBranch(
      owner,
      repo,
    );

  const existingSha =
    await githubAdapter.getFileSha(
      owner,
      repo,
      HOMEMADE_WORKFLOW_PATH,
      defaultBranch,
    );

  const result =
    await githubAdapter.writeTextFile({
      owner,
      repo,

      path:
        HOMEMADE_WORKFLOW_PATH,

      branch:
        defaultBranch,

      message: existingSha
        ? "ci: update Homemade CI/CD pipeline"
        : "ci: add Homemade CI/CD pipeline",

      content: yaml,

      ...(existingSha
        ? {
            sha: existingSha,
          }
        : {}),
    });

  return {
    path:
      HOMEMADE_WORKFLOW_PATH,

    commitSha:
      result.commitSha,

    commitUrl:
      result.commitUrl,

    created:
      !existingSha,
  };
}
