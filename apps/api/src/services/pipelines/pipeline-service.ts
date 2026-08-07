import { github } from "../../lib/github.js";

const WORKFLOW_PATH =
  ".github/workflows/homemade-ci.yml";

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 404
  );
}

async function getExistingWorkflowSha(
  owner: string,
  repo: string,
): Promise<string | undefined> {
  try {
    const { data } =
      await github.rest.repos.getContent({
        owner,
        repo,
        path: WORKFLOW_PATH,
      });

    if (
      Array.isArray(data) ||
      data.type !== "file"
    ) {
      return undefined;
    }

    return data.sha;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function saveWorkflow({
  owner,
  repo,
  branch,
  yaml,
}: {
  owner: string;
  repo: string;
  branch: string;
  yaml: string;
}) {
  const existingSha =
    await getExistingWorkflowSha(owner, repo);

  const response =
    await github.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: WORKFLOW_PATH,

      message: existingSha
        ? "ci: update Homemade CI/CD pipeline"
        : "ci: add Homemade CI/CD pipeline",

      content: Buffer.from(yaml, "utf8").toString(
        "base64",
      ),

      branch,

      ...(existingSha
        ? {
            sha: existingSha,
          }
        : {}),
    });

  return {
    path: WORKFLOW_PATH,
    commitSha: response.data.commit.sha,
    commitUrl: response.data.commit.html_url,
    created: !existingSha,
  };
}