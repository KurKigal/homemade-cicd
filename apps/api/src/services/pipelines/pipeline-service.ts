import {
  githubAdapter,
} from "../../adapters/github/github-adapter.js";

const WORKFLOW_PATH =
  ".github/workflows/homemade-ci.yml";

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
      WORKFLOW_PATH,
      defaultBranch,
    );

  const result =
    await githubAdapter.writeTextFile({
      owner,
      repo,

      path:
        WORKFLOW_PATH,

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
      WORKFLOW_PATH,

    commitSha:
      result.commitSha,

    commitUrl:
      result.commitUrl,

    created:
      !existingSha,
  };
}