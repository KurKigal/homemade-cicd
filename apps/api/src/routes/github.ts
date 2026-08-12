import type {
  FastifyInstance,
} from "fastify";

import {
  getAuthenticatedGitHubUser,
  listGitHubRepositories,
} from "../services/github/github-service.js";

import {
  inspectProject,
} from "../services/project-analysis-service.js";

import {
  parseRouteInput,
  repositoryParamsSchema,
} from "./validation.js";

export async function githubRoutes(
  app: FastifyInstance,
) {
  app.get(
    "/github/me",
    async () => {
      return getAuthenticatedGitHubUser();
    },
  );

  app.get(
    "/github/repos",
    async () => {
      return listGitHubRepositories();
    },
  );

  app.get(
    "/github/repos/:owner/:repo/inspect",
    async (request, reply) => {
      const params = parseRouteInput(
        repositoryParamsSchema,
        request.params,
        reply,
        "Invalid repository.",
      );

      if (!params) {
        return;
      }

      const { owner, repo } = params;

      const analysis =
        await inspectProject(
          owner,
          repo,
        );

      return {
        repository: {
          owner,
          name: repo,
        },

        analysis,
      };
    },
  );
}
